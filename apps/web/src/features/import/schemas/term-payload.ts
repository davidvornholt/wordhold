import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { EntryText } from '../../../shared/vocabulary/entry-fields';
import { ImportPayloadValidationError } from '../errors/import-payload-validation-error';

// The terms the learner checked against a subject's photographed notes. A
// page may close without any, when the notes repeat what the subject has.
export const TermPayload = Schema.Struct({
  pageId: Uuid,
  terms: Schema.Array(
    Schema.Struct({ term: EntryText, definition: EntryText }),
  ).check(Schema.isMaxLength(maximumEntriesPerPage)),
});
export type TermPayloadData = typeof TermPayload.Type;

const decode = Schema.decodeUnknownSync(TermPayload);

export const decodeTermPayload = (input: unknown): TermPayloadData => {
  try {
    return decode(input);
  } catch (cause) {
    // biome-ignore lint/style/useErrorCause: Schema.TaggedError carries cause as a typed field
    throw new ImportPayloadValidationError({
      cause,
      message: 'Die geprüften Begriffe sind ungültig.',
    });
  }
};
