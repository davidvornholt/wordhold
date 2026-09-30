import { Data } from 'effect';

export class DefinitionError extends Data.TaggedError('DefinitionError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}
