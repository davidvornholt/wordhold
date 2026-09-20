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
  // Entries whose cards in every enabled direction have left the learning
  // steps: what the dashboard calls "sicher".
  readonly known: number;
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

export type PracticeDay = {
  // ISO date in the owner's time zone.
  readonly day: string;
  // 0 is Sunday, matching Date.getDay().
  readonly weekday: number;
  readonly practiced: boolean;
};

export type DashboardData = {
  readonly perCourse: ReadonlyArray<CourseStats>;
  readonly fragile: ReadonlyArray<FragileEntry>;
  readonly reviewsToday: number;
  readonly cardsToday: number;
  readonly week: ReadonlyArray<PracticeDay>;
  readonly streak: number;
};

export const hasAvailablePractice = (
  stats: Pick<CourseStats, 'ready'> | undefined,
): boolean => (stats?.ready ?? 0) > 0;

export const totalReady = (
  perCourse: ReadonlyArray<Pick<CourseStats, 'ready'>>,
): number => perCourse.reduce((total, stats) => total + stats.ready, 0);

// The course the "Heute" action opens: the one with the most cards ready.
export const busiestCourse = <Stats extends Pick<CourseStats, 'ready'>>(
  perCourse: ReadonlyArray<Stats>,
): Stats | undefined =>
  perCourse.reduce<Stats | undefined>(
    (best, stats) =>
      stats.ready > 0 && (best === undefined || stats.ready > best.ready)
        ? stats
        : best,
    undefined,
  );

// The "Heute" action names what it opens. When every ready card belongs to
// that course a plain "Jetzt üben" is exact; otherwise the label carries the
// course and its own count so the total above is never mistaken for one
// sitting.
export const todayActionLabel = (
  course: { readonly name: string; readonly ready: number },
  ready: number,
): string =>
  course.ready === ready
    ? 'Jetzt üben'
    : `${course.name} üben · ${course.ready} ${course.ready === 1 ? 'Karte' : 'Karten'}`;
