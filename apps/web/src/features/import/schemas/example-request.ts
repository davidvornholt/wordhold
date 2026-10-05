import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import {
  EntryText,
  ExampleText,
} from '../../../shared/vocabulary/entry-fields';

export const ExampleRequest = Schema.Struct({
  pageId: Uuid,
  targetText: EntryText,
  nativeText: EntryText,
});

export const decodeExampleRequest = Schema.decodeUnknownSync(ExampleRequest);

export const TranslationRequest = Schema.Struct({
  pageId: Uuid,
  targetText: ExampleText,
});

export const decodeTranslationRequest =
  Schema.decodeUnknownSync(TranslationRequest);
