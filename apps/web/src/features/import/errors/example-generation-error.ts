import { Data } from 'effect';

export class ExampleGenerationError extends Data.TaggedError(
  'ExampleGenerationError',
)<{
  readonly message: string;
}> {}
