import type { CourseKind } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';

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
  readonly courseKind: CourseKind;
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

// The fragile entries of one course, which one free sitting can practise.
export type FragileGroup = {
  readonly courseId: string;
  readonly courseName: string;
  readonly courseKind: CourseKind;
  readonly entryIds: ReadonlyArray<string>;
};

// Courses appear in the order of their most fragile entry.
export const fragileGroups = (
  entries: ReadonlyArray<FragileEntry>,
): ReadonlyArray<FragileGroup> => {
  const groups = new Map<string, FragileGroup & { entryIds: Array<string> }>();
  for (const entry of entries) {
    const existing = groups.get(entry.courseId);
    if (existing === undefined) {
      groups.set(entry.courseId, {
        courseId: entry.courseId,
        courseName: entry.courseName,
        courseKind: entry.courseKind,
        entryIds: [entry.entryId],
      });
    } else {
      existing.entryIds.push(entry.entryId);
    }
  }
  return [...groups.values()];
};

// A sitting covers one course. When the list spans several, each action
// names its course and count, as the "Heute" action does.
export const fragileActionLabel = (
  group: FragileGroup,
  groupCount: number,
): string => {
  if (groupCount === 1) {
    return 'Wackelkandidaten üben';
  }
  const nouns = courseNouns({ kind: group.courseKind });
  const count = countNoun(group.entryIds.length, nouns.singular, nouns.plural);
  return `${group.courseName} üben · ${count}`;
};
