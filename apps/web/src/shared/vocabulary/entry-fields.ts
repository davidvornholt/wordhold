import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';

// The version of an entry an editor loaded; see entries.revision.
export const EntryRevision = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const EntryText = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumEntryTextLength),
);

// A text learned by heart can be a whole psalm or poem, far longer than a
// word or a definition.
export const maximumMemorizedTextLength = 4000;

export const MemorizedText = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumMemorizedTextLength),
);

export const ExampleText = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumExampleLength),
);

// An example sentence as it is stored with a new entry: the sentence, its
// German translation when one exists, and whether the textbook or the
// sentence generator wrote it.
export const NewExample = Schema.Struct({
  targetText: ExampleText,
  nativeText: Schema.optional(ExampleText),
  source: Schema.Literals(['textbook', 'generated']),
});
export type NewExampleData = typeof NewExample.Type;

export const GeneratedExample = Schema.Struct({
  target: ExampleText,
  native: ExampleText,
});
export const decodeGeneratedExample =
  Schema.decodeUnknownEffect(GeneratedExample);
