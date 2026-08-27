export type CourseStats = {
  readonly courseId: string;
  readonly due: number;
  readonly fresh: number;
  readonly unlearned: number;
  readonly words: number;
};

export type FragileWord = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly courseName: string;
  readonly failures: number;
};

export type DashboardData = {
  readonly perCourse: ReadonlyArray<CourseStats>;
  readonly fragile: ReadonlyArray<FragileWord>;
  readonly reviewsToday: number;
};

export const hasAvailablePractice = (
  stats: Pick<CourseStats, 'due' | 'fresh'> | undefined,
): boolean => (stats?.due ?? 0) + (stats?.fresh ?? 0) > 0;
