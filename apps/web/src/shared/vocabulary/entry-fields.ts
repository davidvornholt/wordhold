import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';

export const EntryText = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumEntryTextLength),
);

export const ExampleText = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumExampleLength),
);

// An example sentence as it is stored with a new entry: the sentence, its
// German translation when one exists, and whether the textbook or the
// sentence generator wrote it.
export const NewExample = Schema.Struct({
  targetText: ExampleText,
  nativeText: Schema.optional(ExampleText),
  source: Schema.Literal('textbook', 'generated'),
});
export type NewExampleData = typeof NewExample.Type;

export const GeneratedExample = Schema.Struct({
  target: ExampleText,
  native: ExampleText,
});
export const decodeGeneratedExample = Schema.decodeUnknown(GeneratedExample);
