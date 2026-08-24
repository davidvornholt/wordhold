import { Data } from 'effect';

export class UploadValidationError extends Data.TaggedError(
  'UploadValidationError',
)<{
  readonly message: string;
  readonly status: number;
}> {}
