import { Data } from 'effect';

// Why a page reading failed: the provider rejected or did not answer the
// request, or it answered with something the page schema does not accept.
export type ExtractionFailureReason = 'provider' | 'invalidOutput';

export class ExtractionError extends Data.TaggedError('ExtractionError')<{
  readonly reason: ExtractionFailureReason;
  readonly message: string;
  readonly cause: unknown;
}> {}
