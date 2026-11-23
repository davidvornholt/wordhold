import type { ExampleDraft } from '../../../shared/examples/example-draft';
import type { NewExampleData } from '../../../shared/vocabulary/entry-fields';

export type NewVocabularyEntryDraft = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: NewExampleData | undefined;
};

export const emptyDraft: ExampleDraft = {
  targetText: '',
  nativeText: '',
  example: '',
  exampleNativeText: '',
};

// The example as it is stored: none without a sentence.
export const exampleOf = (draft: ExampleDraft): NewExampleData | undefined => {
  const sentence = draft.example.trim();
  if (sentence === '') {
    return undefined;
  }
  const translation = draft.exampleNativeText.trim();
  return {
    targetText: sentence,
    nativeText: translation === '' ? undefined : translation,
    source: draft.exampleGenerated === true ? 'generated' : 'textbook',
  };
};

export const quoted = (word: string): string => `„${word}“`;
