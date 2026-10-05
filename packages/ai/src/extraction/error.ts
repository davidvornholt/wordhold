import { Schema } from 'effect';

// Why a page reading failed: the provider rejected or did not answer the
// request, or it answered with something the page schema does not accept.
const ExtractionFailureReason = Schema.Literals(['provider', 'invalidOutput']);
export type ExtractionFailureReason = typeof ExtractionFailureReason.Type;

export class ExtractionError extends Schema.TaggedError<ExtractionError>()(
  'ExtractionError',
  {
    reason: ExtractionFailureReason,
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}
