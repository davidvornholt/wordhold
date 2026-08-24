import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection, EntryType } from '@wordhold/db/schema/entries';
import type { cards } from '@wordhold/db/schema/practice';
import type {
  DerivedRating,
  GradeOutcome,
} from '../../../shared/grading/rating';

export type PracticeItem = {
  readonly cardId: string;
  readonly revision: number;
  readonly direction: AnswerDirection;
  readonly entryId: string;
  readonly entryType: EntryType;
  readonly targetText: string;
  readonly nativeText: string;
  readonly hasAudio: boolean;
  readonly prompt: string;
};

export type SubmissionRecord = {
  readonly card: typeof cards.$inferSelect;
  readonly entry: {
    readonly id: string;
    readonly type: EntryType;
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
};

export type CachedJudgeVerdict = {
  readonly verdict: JudgeVerdictData;
  readonly model: string;
};

export type JudgeCacheKey = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
};
