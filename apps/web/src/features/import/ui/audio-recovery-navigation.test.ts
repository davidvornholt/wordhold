import { describe, expect, it } from 'bun:test';
import { finishAudioRecovery } from './audio-recovery-navigation';

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const makeDeferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

describe('finishAudioRecovery', () => {
  it('refreshes shared data without navigating after the screen was left', async () => {
    const retry = makeDeferred();
    let active = true;
    let refreshes = 0;
    let navigations = 0;
    const recovery = finishAudioRecovery({
      finishNavigation: () => {
        navigations += 1;
        return Promise.resolve();
      },
      refreshOverview: () => {
        refreshes += 1;
        return Promise.resolve();
      },
      retry: () => retry.promise,
      shouldNavigate: () => active,
    });

    active = false;
    retry.resolve();
    await recovery;

    expect(refreshes).toBe(1);
    expect(navigations).toBe(0);
  });
});
