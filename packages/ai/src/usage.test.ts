import { describe, expect, it } from 'bun:test';
import type { LanguageModelUsage } from 'ai';
import { Effect, Exit } from 'effect';
import {
  type AiCallUsage,
  AiUsage,
  languageModelTokens,
  metered,
} from './usage';
import { AiUsageError } from './usage-error';

const usage = (
  input: number | undefined,
  details: LanguageModelUsage['inputTokenDetails'],
  output: number | undefined,
): LanguageModelUsage => ({
  inputTokens: input,
  inputTokenDetails: details,
  outputTokens: output,
  outputTokenDetails: {
    textTokens: undefined,
    reasoningTokens: undefined,
  },
  totalTokens: undefined,
});

describe('languageModelTokens', () => {
  it('separates cached input from the input the model processed', () => {
    expect(
      languageModelTokens(
        usage(
          120,
          {
            noCacheTokens: undefined,
            cacheReadTokens: 20,
            cacheWriteTokens: undefined,
          },
          30,
        ),
      ),
    ).toEqual({ input: 100, cachedInput: 20, cacheWrite: 0, output: 30 });
  });

  it('is unknown when the provider reports no counts', () => {
    expect(
      languageModelTokens(
        usage(
          undefined,
          {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          30,
        ),
      ),
    ).toBeUndefined();
  });
});

type Settled = { succeeded: boolean; usage: AiCallUsage | undefined };

const recording = (settled: Array<Settled>, refuse = false) =>
  AiUsage.of({
    start: () =>
      refuse
        ? Effect.fail(
            new AiUsageError({ message: 'Dieses Konto ist gesperrt.' }),
          )
        : Effect.succeed({
            settle: (outcome) =>
              Effect.sync(() => {
                settled.push(outcome);
              }),
          }),
  });

const call = {
  operation: 'speech',
  provider: 'polly',
  model: 'generative',
} as const;

describe('metered', () => {
  it('settles the reported usage after a request', async () => {
    const settled: Array<Settled> = [];
    const result = await Effect.runPromise(
      metered(call, (report) =>
        Effect.sync(() => {
          report({ characters: 5, raw: null });
          return 'audio';
        }),
      ).pipe(Effect.provideService(AiUsage, recording(settled))),
    );
    expect(result).toBe('audio');
    expect(settled).toEqual([
      { succeeded: true, usage: { characters: 5, raw: null } },
    ]);
  });

  it('settles a failed request with the usage it was billed for', async () => {
    const settled: Array<Settled> = [];
    const exit = await Effect.runPromiseExit(
      metered(call, (report) =>
        Effect.suspend(() => {
          report({ characters: 5, raw: null });
          return Effect.fail('rejected');
        }),
      ).pipe(Effect.provideService(AiUsage, recording(settled))),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(settled).toEqual([
      { succeeded: false, usage: { characters: 5, raw: null } },
    ]);
  });

  it('does not send a request that may not start', async () => {
    let sent = false;
    const exit = await Effect.runPromiseExit(
      metered(call, () =>
        Effect.sync(() => {
          sent = true;
        }),
      ).pipe(Effect.provideService(AiUsage, recording([], true))),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(sent).toBe(false);
  });
});
