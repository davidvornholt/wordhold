import type { AnswerDirection } from '@wordhold/db/schema/directions';

export type DirectionStats = {
  readonly direction: AnswerDirection;
  readonly due: number;
  readonly firstReviews: number;
  readonly ready: number;
  readonly nextDueAt: Date | null;
};

export type CourseStats = {
  readonly courseId: string;
  readonly due: number;
  readonly firstReviews: number;
  readonly ready: number;
  readonly unintroduced: number;
  readonly entries: number;
  readonly nextDueAt: Date | null;
  readonly directions: ReadonlyArray<DirectionStats>;
};

export type FragileEntry = {
  readonly entryId: string;
  readonly courseId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly courseName: string;
  readonly failures: number;
};

export type DashboardData = {
  readonly perCourse: ReadonlyArray<CourseStats>;
  readonly fragile: ReadonlyArray<FragileEntry>;
  readonly reviewsToday: number;
  readonly cardsToday: number;
};

export const hasAvailablePractice = (
  stats: Pick<CourseStats, 'ready'> | undefined,
): boolean => (stats?.ready ?? 0) > 0;
