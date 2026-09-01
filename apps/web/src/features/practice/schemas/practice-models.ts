import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
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
  readonly hasAudio: boolean;
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
  };
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

export type CachedJudgeVerdict = {
  readonly assessmentId: string;
  readonly verdict: JudgeVerdictData;
  readonly model: string;
};

export type JudgeVerdict = Omit<CachedJudgeVerdict, 'assessmentId'>;

export type JudgeCacheKey = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
};
