import { describe, expect, it } from 'bun:test';
import {
  classifyServerFailure,
  failureMessage,
  type RetryTiming,
  retryUnreachable,
  unavailableMessage,
} from './server-retry';

const staleMessage =
  'Diese Karte wurde bereits beantwortet. Lade die Übung neu.';

// Start's client throws the body of a non-JSON response as the message.
const responseBodyError = (body: string) => new Error(body);

describe('classifyServerFailure', () => {
  it('treats a failed fetch as a network failure', () => {
    for (const message of [
      'Failed to fetch',
      'Load failed',
      'NetworkError when attempting to fetch resource.',
    ]) {
      expect(classifyServerFailure(new TypeError(message))).toEqual({
        kind: 'network',
      });
    }
  });

  it('treats what a proxy sends in place of the app as unavailable', () => {
    for (const cause of [
      responseBodyError(''),
      responseBodyError('  \n'),
      responseBodyError(
        '<html><head><title>502 Bad Gateway</title></head><body></body></html>',
      ),
      responseBodyError('502 Bad Gateway'),
      responseBodyError('Service Unavailable'),
      responseBodyError('504 Gateway Time-out'),
      new Error('Invariant failed'),
      new Error('Invariant failed: expected content-type header to be set'),
      new SyntaxError('Unexpected token < in JSON at position 0'),
      undefined,
    ]) {
      expect(classifyServerFailure(cause)).toEqual({ kind: 'unavailable' });
    }
  });

  it('keeps the message of an error the server function reported', () => {
    expect(classifyServerFailure(new Error(staleMessage))).toEqual({
      kind: 'reported',
      message: staleMessage,
    });
    expect(classifyServerFailure(new Error(' Nicht angemeldet.\n'))).toEqual({
      kind: 'reported',
      message: 'Nicht angemeldet.',
    });
  });
});

describe('failureMessage', () => {
  const offline = 'Prüfe deine Verbindung.';

  it('names the cause the learner can act on', () => {
    expect(failureMessage(new TypeError('Failed to fetch'), offline)).toBe(
      offline,
    );
    expect(failureMessage(responseBodyError(''), offline)).toBe(
      unavailableMessage,
    );
    expect(failureMessage(new Error(staleMessage), offline)).toBe(staleMessage);
  });
});

// A clock that only moves when the retry waits or an attempt takes time.
const fakeTiming = () => {
  let now = 0;
  const waits: Array<number> = [];
  const timing: RetryTiming = {
    now: () => now,
    wait: (milliseconds) => {
      waits.push(milliseconds);
      now += milliseconds;
      return Promise.resolve();
    },
  };
  const spend = (milliseconds: number) => {
    now += milliseconds;
  };
  return { timing, waits, spend };
};

// A call that fails with the given causes in turn and then answers.
const scriptedCall = (failures: ReadonlyArray<unknown>) => {
  let calls = 0;
  const call = () => {
    calls += 1;
    return calls <= failures.length
      ? Promise.reject(failures[calls - 1])
      : Promise.resolve('answered');
  };
  return { call, calls: () => calls };
};

describe('retryUnreachable', () => {
  it('does not start another call after the caller leaves during backoff', async () => {
    const { timing, waits } = fakeTiming();
    const offline = new TypeError('Failed to fetch');
    const { call, calls } = scriptedCall([offline]);
    let active = true;

    const retried = retryUnreachable(call, {
      isActive: () => active,
      onReconnecting: () => undefined,
      timing: {
        ...timing,
        wait: async (milliseconds) => {
          await timing.wait(milliseconds);
          active = false;
        },
      },
    });

    await expect(retried).rejects.toBe(offline);
    expect(calls()).toBe(1);
    expect(waits).toEqual([500]);
  });

  it('repeats a call the proxy answered until the app answers', async () => {
    const { timing, waits } = fakeTiming();
    const { call, calls } = scriptedCall([
      responseBodyError(''),
      responseBodyError('502 Bad Gateway'),
    ]);
    let reconnecting = 0;

    const result = await retryUnreachable(call, {
      isActive: () => true,
      onReconnecting: () => {
        reconnecting += 1;
      },
      timing,
    });

    expect(result).toBe('answered');
    expect(calls()).toBe(2 + 1);
    expect(waits).toEqual([500, 1000]);
    expect(reconnecting).toBe(0);
  });

  it('tells the learner once after the quick retries failed', async () => {
    const { timing, waits } = fakeTiming();
    const offline = new TypeError('Failed to fetch');
    const { call } = scriptedCall([offline, offline, offline, offline]);
    let reconnecting = 0;

    await retryUnreachable(call, {
      isActive: () => true,
      onReconnecting: () => {
        reconnecting += 1;
      },
      timing,
    });

    expect(waits).toEqual([500, 1000, 2000, 4000]);
    expect(reconnecting).toBe(1);
  });

  it('gives up after about 20 seconds with the last failure', async () => {
    const { timing, waits } = fakeTiming();
    const failures = Array.from(
      { length: 20 },
      (_, index) => new TypeError(`Attempt ${index + 1}`),
    );
    const { call, calls } = scriptedCall(failures);

    const retried = retryUnreachable(call, {
      isActive: () => true,
      onReconnecting: () => undefined,
      timing,
    });

    await expect(retried).rejects.toBe(failures[7]);
    expect(calls()).toBe(8);
    expect(waits).toEqual([500, 1000, 2000, 4000, 4000, 4000, 4000]);
  });

  it('counts slow attempts against the 20 seconds', async () => {
    const { timing, spend } = fakeTiming();
    const offline = new TypeError('Failed to fetch');
    let calls = 0;
    const slowCall = () => {
      calls += 1;
      spend(15_000);
      return Promise.reject(offline);
    };

    const retried = retryUnreachable(slowCall, {
      isActive: () => true,
      onReconnecting: () => undefined,
      timing,
    });

    await expect(retried).rejects.toBe(offline);
    expect(calls).toBe(2);
  });

  it('passes on an error the server reported without repeating the call', async () => {
    const { timing, waits } = fakeTiming();
    const stale = new Error(staleMessage);
    const { call, calls } = scriptedCall([stale]);

    const retried = retryUnreachable(call, {
      isActive: () => true,
      onReconnecting: () => undefined,
      timing,
    });

    await expect(retried).rejects.toBe(stale);
    expect(calls()).toBe(1);
    expect(waits).toEqual([]);
  });
});
