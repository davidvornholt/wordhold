import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';

export const ExampleRequest = Schema.Struct({
  pageId: Schema.UUID,
  targetText: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumEntryTextLength),
  ),
  nativeText: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumEntryTextLength),
  ),
});

export const GeneratedExample = Schema.Struct({
  target: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumExampleLength),
  ),
  native: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumExampleLength),
  ),
});

export const decodeExampleRequest = Schema.decodeUnknownSync(ExampleRequest);
export const decodeGeneratedExample = Schema.decodeUnknown(GeneratedExample);
