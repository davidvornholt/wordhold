import { Data } from 'effect';

export class PasskeyListError extends Data.TaggedError('PasskeyListError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}
