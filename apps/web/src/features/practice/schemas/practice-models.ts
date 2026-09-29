import type { DefinitionVerdictData } from '@wordhold/ai/definition/schema';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type {
  CardState,
  cards,
  ReviewMode,
} from '@wordhold/db/schema/practice';
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
  readonly hasAudio: boolean;
  // Where the card stands before this sitting, so the summary can count the
  // cards that graduated to review during it.
  readonly state: CardState;
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

export type SubmitResult =
  | {
      readonly graded: false;
      readonly expectedAnswers: ReadonlyArray<string>;
      readonly message: string;
    }
  | {
      readonly graded: true;
      readonly correct: false;
      readonly stored: false;
      readonly expectedAnswers: ReadonlyArray<string>;
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
      readonly expectedAnswers: ReadonlyArray<string>;
      readonly explanation: string | null;
      readonly acceptedAsAlternative: boolean;
      // Only for a definition the judge graded; null otherwise.
      readonly keyPoints: ReadonlyArray<KeyPointFinding> | null;
      readonly schedule: CardSchedule;
    };

export type ResolvedSubmitResult = Exclude<
  SubmitResult,
  { readonly graded: true; readonly stored: false }
>;

export type SubmissionRecord = {
  readonly card: typeof cards.$inferSelect;
  readonly entry: {
    readonly id: string;
    readonly targetText: string;
    readonly nativeText: string;
    readonly keyPoints: ReadonlyArray<string> | null;
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
};

export type PersistedReview = {
  readonly revision: number;
  readonly schedule: CardSchedule;
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
