import { Data } from 'effect';

export class ImportPayloadValidationError extends Data.TaggedError(
  'ImportPayloadValidationError',
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}
