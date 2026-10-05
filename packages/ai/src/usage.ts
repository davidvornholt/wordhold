import type { LanguageModelUsage } from 'ai';
import { Context, Effect, Exit } from 'effect';
import type { AiUsageError } from './usage-error';

// Every paid request the application makes, named after what it is for.
export const aiOperations = [
  'page-extraction',
  'answer-grading',
  'definition-grading',
  'definition-key-points',
  'definition-suggestion',
  'sentence-grading',
  'example-generation',
  'example-translation',
  'word-translation',
  'speech',
  'transcription',
] as const;
export type AiOperation = (typeof aiOperations)[number];

export type AiCall = {
  readonly operation: AiOperation;
  readonly provider: 'bedrock' | 'polly' | 'transcribe';
  readonly model: string;
};

export type TokenCounts = {
  readonly input: number;
  readonly cachedInput: number;
  readonly cacheWrite: number;
  readonly output: number;
};

// What the provider reported for one request. Counts the provider did not
// report stay undefined, so their cost stays unknown instead of zero. `raw`
// keeps the provider's own figures for later checks.
export type AiCallUsage = {
  readonly tokens?: TokenCounts;
  readonly characters?: number;
  // Seconds of audio, as billed.
  readonly audioSeconds?: number;
  readonly raw: unknown;
};

export type AiUsageRecord = {
  // Never fails: the request has already happened, so a record that cannot be
  // completed is logged and stays pending.
  readonly settle: (outcome: {
    readonly succeeded: boolean;
    readonly usage: AiCallUsage | undefined;
  }) => Effect.Effect<void>;
};

// Records who caused each paid request. The application provides one per
// person, so every service method that calls a provider requires it.
export class AiUsage extends Context.Tag('@wordhold/ai/AiUsage')<
  AiUsage,
  {
    // Fails when the request must not start, such as for a suspended person.
    readonly start: (
      call: AiCall,
    ) => Effect.Effect<AiUsageRecord, AiUsageError>;
  }
>() {}

const tokenCount = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

// Bedrock reports cached input apart from the input it processes, and its
// output already includes the reasoning tokens.
export const languageModelTokens = (
  usage: LanguageModelUsage,
): TokenCounts | undefined => {
  const cachedInput = tokenCount(usage.inputTokenDetails.cacheReadTokens) ?? 0;
  const cacheWrite = tokenCount(usage.inputTokenDetails.cacheWriteTokens) ?? 0;
  const total = tokenCount(usage.inputTokens);
  const input =
    tokenCount(usage.inputTokenDetails.noCacheTokens) ??
    (total === undefined ? undefined : total - cachedInput - cacheWrite);
  const output = tokenCount(usage.outputTokens);
  if (input === undefined || input < 0 || output === undefined) {
    return undefined;
  }
  return { input, cachedInput, cacheWrite, output };
};

export const languageModelUsage = (usage: LanguageModelUsage): AiCallUsage => {
  const tokens = languageModelTokens(usage);
  return tokens === undefined ? { raw: usage } : { tokens, raw: usage };
};

// Runs one paid request between a pending record and its outcome. The
// request reports usage through `report` as soon as the provider returns it,
// including on a failure that was still billed.
export const metered = <A, E, R>(
  call: AiCall,
  request: (report: (usage: AiCallUsage) => void) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | AiUsageError, R | AiUsage> =>
  Effect.flatMap(AiUsage, (usage) => usage.start(call)).pipe(
    Effect.flatMap((record) => {
      let reported: AiCallUsage | undefined;
      return request((value) => {
        reported = value;
      }).pipe(
        Effect.onExit((exit) =>
          record.settle({ succeeded: Exit.isSuccess(exit), usage: reported }),
        ),
      );
    }),
  );
