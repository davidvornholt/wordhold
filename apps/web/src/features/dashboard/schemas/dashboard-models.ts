export type CourseStats = {
  readonly courseId: string;
  readonly due: number;
  readonly fresh: number;
  readonly unlearned: number;
  readonly entries: number;
};

export type FragileEntry = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly courseName: string;
  readonly failures: number;
};

export type DashboardData = {
  readonly perCourse: ReadonlyArray<CourseStats>;
  readonly fragile: ReadonlyArray<FragileEntry>;
  readonly reviewsToday: number;
};

export const hasAvailablePractice = (
  stats: Pick<CourseStats, 'due' | 'fresh'> | undefined,
): boolean => (stats?.due ?? 0) + (stats?.fresh ?? 0) > 0;
