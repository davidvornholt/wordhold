import type { DefinitionVerdictData } from '@wordhold/ai/definition/schema';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { cards, ReviewMode } from '@wordhold/db/schema/practice';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import type {
  DerivedRating,
  GradeOutcome,
} from '../../../shared/grading/rating';

export type PracticeItem = {
  readonly cardId: string;
  readonly revision: number;
  readonly direction: AnswerDirection;
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  // For a synonym or antonym card, the words it asks for; empty otherwise.
  readonly relatedWords: ReadonlyArray<string>;
  // Where the word is most often misspelled, once derived. Always null
  // outside a language course.
  readonly spellingPitfalls: ReadonlyArray<SpellingPitfall> | null;
  readonly hasAudio: boolean;
  // Whether the entry already counted as "sicher" when the sitting loaded, so
  // the summary can count the entries the sitting made sicher.
  readonly entryKnown: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly prompt: string;
};

export type PracticeAvailability = {
  readonly due: number;
  readonly firstReviews: number;
  readonly ready: number;
  readonly nextDueAt: Date | null;
};

export type CardSchedule = {
  readonly advanced: boolean;
  readonly state: (typeof cards.$inferSelect)['state'];
  readonly dueAt: Date | null;
};

export type PracticeSession = {
  readonly items: ReadonlyArray<PracticeItem>;
  readonly available: PracticeAvailability;
};

// Ready cards the sitting did not draw: what "Weitere X üben" would start.
export const remainingReadyCount = (session: PracticeSession): number =>
  Math.max(
    0,
    session.available.due +
      session.available.firstReviews -
      session.items.length,
  );

// How a typed definition fared on one key point, in the stored order.
export type KeyPointFinding = {
  readonly text: string;
  readonly covered: boolean;
  readonly note: string | null;
};

// Another entry of the course: its target-language text as the book writes
// it, and where the book teaches it, which is its unit or, for a word without
// a unit, its book.
export type CourseEntryPlace = {
  readonly text: string;
  readonly place: string;
};

// A correct translation in other words than the textbook's. It is neither
// graded nor stored, and it carries no solution: the card stays open and the
// learner looks for the textbook's word. `courseEntry` names the entry of the
// course the answer spells out, if any.
export type OtherWordingResult = {
  readonly otherWording: true;
  readonly courseEntry: CourseEntryPlace | null;
};

// `expectedAnswer` is the card's textbook answer: the solution the entry
// intends, never an alternative the judge accepted along the way. For a
// synonym or antonym card it is the whole stored list.
export type SubmitResult =
  | OtherWordingResult
  | {
      readonly graded: false;
      readonly expectedAnswer: string;
      readonly message: string;
    }
  | {
      readonly graded: true;
      readonly correct: false;
      readonly stored: false;
      readonly expectedAnswer: string;
      readonly explanation: string | null;
      readonly acceptedAsAlternative: false;
      readonly keyPoints: ReadonlyArray<KeyPointFinding> | null;
      readonly assessmentId: string;
    }
  | {
      readonly graded: true;
      readonly correct: boolean;
      readonly stored: true;
      readonly revision: number;
      readonly rating: number;
      readonly expectedAnswer: string;
      readonly explanation: string | null;
      readonly acceptedAsAlternative: boolean;
      // Only for a definition the judge graded; null otherwise.
      readonly keyPoints: ReadonlyArray<KeyPointFinding> | null;
      readonly schedule: CardSchedule;
      // Whether the entry counts as "sicher" after this answer.
      readonly entryKnown: boolean;
    };

// Every result the card answers with feedback: all but another wording,
// which leaves the card open.
export type FeedbackResult = Exclude<SubmitResult, OtherWordingResult>;

export type ResolvedSubmitResult = Exclude<
  FeedbackResult,
  { readonly graded: true; readonly stored: false }
>;

export type SubmissionRecord = {
  readonly card: typeof cards.$inferSelect;
  readonly entry: {
    readonly id: string;
    readonly targetText: string;
    readonly nativeText: string;
    readonly keyPoints: ReadonlyArray<string> | null;
    // For a synonym or antonym card, the words it asks for; empty otherwise.
    readonly relatedWords: ReadonlyArray<string>;
  };
  readonly courseKind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

export type PersistReviewInput = {
  readonly card: typeof cards.$inferSelect;
  readonly expectedRevision: number;
  readonly rating: DerivedRating;
  readonly reviewedAt: Date;
  readonly outcome: GradeOutcome;
  readonly answer: string;
  readonly elapsedMs: number | null;
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
  readonly mode: ReviewMode;
  // The entry's texts when the answer was graded. A judge alternative is kept
  // only while the entry still has them.
  readonly gradedTexts: {
    readonly targetText: string;
    readonly nativeText: string;
  };
};

export type PersistedReview = {
  readonly revision: number;
  readonly schedule: CardSchedule;
  readonly entryKnown: boolean;
  readonly alternativeStored: boolean;
};

// A judge_cache row holds a translation or a definition verdict. The entry's
// course decides which one is asked for, and the prompt hash in `model`
// keeps a row from answering for the other.
export type StoredVerdict = JudgeVerdictData | DefinitionVerdictData;

export type CachedVerdict<V extends StoredVerdict = StoredVerdict> = {
  readonly assessmentId: string;
  readonly verdict: V;
  readonly model: string;
};

export type CachedJudgeVerdict = CachedVerdict<JudgeVerdictData>;

export type JudgeVerdict = Omit<CachedJudgeVerdict, 'assessmentId'>;

export type JudgeCacheKey = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
};
