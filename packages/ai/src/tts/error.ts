import { Data } from 'effect';

export class TtsError extends Data.TaggedError('TtsError')<{
  readonly cause: unknown;
}> {}
