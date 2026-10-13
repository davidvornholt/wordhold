import type { TranslationDirection } from '@wordhold/db/schema/directions';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';

// One direction of a learning pass. Its answer starts as the input placeholder
// and screen-reader hint; both disappear once the learner types. The accepted
// answers travel with the item, so matching needs no round trip or grading.
// Synonyms and antonyms have no learning pass; they are asked once their word
// is learned.
export type LearnItem = {
  readonly cardId: string;
  readonly direction: TranslationDirection;
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly hasAudio: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly textbookAnswers: ReadonlyArray<string>;
  // What a definition must state, once derived. Always null for vocabulary.
  readonly keyPoints: ReadonlyArray<string> | null;
};

export type LearnSelectionPass = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly directions: ReadonlyArray<{
    readonly direction: TranslationDirection;
    readonly unintroduced: number;
  }>;
};

// The learning pass of one book's own words or one unit, named for the
// screen's title.
export type LearnPass = LearnSelectionPass & {
  readonly name: string;
};
