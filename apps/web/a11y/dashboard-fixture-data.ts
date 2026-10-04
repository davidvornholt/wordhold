import type { CourseStats } from '../src/features/dashboard/schemas/dashboard-models';

// The courses on the overview and what each holds.
export const course = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'English A2',
  kind: 'language' as const,
  targetLanguage: 'en' as const,
};
export const secondCourse = {
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Französisch',
  kind: 'language' as const,
  targetLanguage: 'fr' as const,
};
export const subject = {
  id: '00000000-0000-0000-0000-000000000006',
  name: 'Chemie',
  kind: 'terms' as const,
  targetLanguage: 'de' as const,
};
export const collection = {
  id: '00000000-0000-0000-0000-000000000008',
  name: 'Bibelverse',
  kind: 'texts' as const,
  targetLanguage: 'de' as const,
};
const subjectReady = 3;
const secondCourseReady = 20;

const millisecondsPerDay = 86_400_000;
// Relative to the real clock so the resting copy reads "morgen um …" on any
// day the suite runs.
export const fixtureNextDueAt = new Date(Date.now() + millisecondsPerDay);

export const secondCourseStats: CourseStats = {
  courseId: secondCourse.id,
  due: secondCourseReady,
  firstReviews: 0,
  ready: secondCourseReady,
  unintroduced: 0,
  entries: 80,
  known: 12,
  nextDueAt: fixtureNextDueAt,
  directions: [
    {
      direction: 'to_target' as const,
      due: secondCourseReady,
      firstReviews: 0,
      ready: secondCourseReady,
      nextDueAt: fixtureNextDueAt,
    },
  ],
};

export const subjectStats: CourseStats = {
  courseId: subject.id,
  due: subjectReady,
  firstReviews: 0,
  ready: subjectReady,
  unintroduced: 2,
  entries: 14,
  known: 5,
  nextDueAt: fixtureNextDueAt,
  directions: [
    {
      direction: 'to_native' as const,
      due: subjectReady,
      firstReviews: 0,
      ready: subjectReady,
      nextDueAt: fixtureNextDueAt,
    },
  ],
};

// A collection with its last text still to learn.
export const collectionStats: CourseStats = {
  ...subjectStats,
  courseId: collection.id,
  due: 0,
  ready: 0,
  unintroduced: 1,
  entries: 3,
  known: 2,
  directions: [],
};

export const fragileWord = {
  entryId: '00000000-0000-0000-0000-000000000002',
  courseId: course.id,
  courseKind: 'language' as const,
  targetText: 'memory',
  nativeText: 'Erinnerung',
  courseName: 'English A2',
  failures: 2,
};

export const fragileTerm = {
  entryId: '00000000-0000-0000-0000-000000000007',
  courseId: subject.id,
  courseKind: 'terms' as const,
  targetText: 'Katalysator',
  nativeText: 'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt.',
  courseName: 'Chemie',
  failures: 3,
};
