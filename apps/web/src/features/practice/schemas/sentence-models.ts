import { maximumExampleLength } from '@wordhold/ai/extraction/schema';
import { Option, Schema } from 'effect';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { VocabularySelection } from '../../../shared/session/vocabulary-selection';

// Sentence practice draws from one book's own words, one unit, or the words
// picked in a word list, like the sittings it is opened from.
export const SentenceSessionRequest = Schema.Struct({
  courseId: Schema.UUID,
  selection: VocabularySelection,
});

export type SentenceSessionRequestData = typeof SentenceSessionRequest.Type;

export const decodeSentenceSessionRequest = Schema.decodeUnknownSync(
  SentenceSessionRequest,
);

// `sentence` is the German sentence the learner saw. The answer is graded
// against the example stored now, so a sentence edited in the meantime is
// refused instead of being graded against a translation of something else.
export const SentenceAnswer = Schema.Struct({
  entryId: Schema.UUID,
  sentence: Schema.String.pipe(Schema.maxLength(maximumExampleLength)),
  answer: Schema.Trim.pipe(
    Schema.nonEmptyString(),
    Schema.maxLength(maximumExampleLength),
  ),
});

export type SentenceAnswerData = typeof SentenceAnswer.Type;

export const decodeSentenceAnswer = Schema.decodeUnknownSync(SentenceAnswer);

// One vocabulary item whose example sentence is translated. The example is
// prepared on the client after the sitting starts, as in card practice.
export type SentenceItem = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: PreparedExampleSentence | null;
};

export type SentenceSession = {
  readonly items: ReadonlyArray<SentenceItem>;
};

// `reference` is the stored translation, shown after every answer. An
// ungraded answer carries the reason the judge could not be reached.
export type SentenceResult =
  | {
      readonly graded: false;
      readonly reference: string;
      readonly message: string;
    }
  | {
      readonly graded: true;
      readonly correct: boolean;
      readonly reference: string;
      readonly correction: string | null;
      readonly explanation: string | null;
    };

const SentenceSearch = Schema.Struct({
  book: Schema.optional(Schema.UUID),
  unit: Schema.optional(Schema.UUID),
  entries: Schema.optional(Schema.String),
});

export type SentenceSearchData = typeof SentenceSearch.Type;

const decodeSearch = Schema.decodeUnknownOption(SentenceSearch);

// A hand-edited URL falls back to no selection, which leads back to the
// course.
export const parseSentenceSearch = (input: unknown): SentenceSearchData =>
  Option.getOrElse(decodeSearch(input), (): SentenceSearchData => ({}));
