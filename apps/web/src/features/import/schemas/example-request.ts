import { Schema } from 'effect';
import {
  EntryText,
  ExampleText,
} from '../../../shared/vocabulary/entry-fields';

export const ExampleRequest = Schema.Struct({
  pageId: Schema.UUID,
  targetText: EntryText,
  nativeText: EntryText,
});

export const decodeExampleRequest = Schema.decodeUnknownSync(ExampleRequest);

export const TranslationRequest = Schema.Struct({
  pageId: Schema.UUID,
  targetText: ExampleText,
});

export const decodeTranslationRequest =
  Schema.decodeUnknownSync(TranslationRequest);
