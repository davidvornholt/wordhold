import { WordholdApi } from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import type { Course, Progress } from '@wordhold/api/vocabulary';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { runIn } from '../../../shared/api/api-failure';
import { serverEnv } from '../../../shared/env/server';
import type {
  CourseStats,
  CourseSummary,
  DashboardData,
} from '../schemas/dashboard-models';
import { dashboardRuntime } from '../services/dashboard-runtime';
import { DashboardService } from '../services/dashboard-service';

const instant = (date: Date | null) =>
  date === null ? null : date.toISOString();

const noStats: Omit<CourseStats, 'courseId'> = {
  due: 0,
  firstReviews: 0,
  ready: 0,
  unintroduced: 0,
  entries: 0,
  known: 0,
  nextDueAt: null,
  directions: [],
};

export const toApiCourse = (
  course: CourseSummary,
  stats: CourseStats | undefined,
): Course => {
  const numbers = stats ?? noStats;
  return {
    id: course.id,
    name: course.name,
    kind: course.kind,
    targetLanguage: course.targetLanguage,
    entries: numbers.entries,
    known: numbers.known,
    unintroduced: numbers.unintroduced,
    due: numbers.due,
    firstReviews: numbers.firstReviews,
    ready: numbers.ready,
    nextDueAt: instant(numbers.nextDueAt),
    directions: numbers.directions.map((direction) => ({
      direction: direction.direction,
      due: direction.due,
      firstReviews: direction.firstReviews,
      ready: direction.ready,
      nextDueAt: instant(direction.nextDueAt),
    })),
  };
};

export const toApiProgress = (dashboard: DashboardData): Progress => ({
  ready: dashboard.perCourse.reduce((sum, course) => sum + course.ready, 0),
  reviewsToday: dashboard.reviewsToday,
  cardsToday: dashboard.cardsToday,
  streak: dashboard.streak,
  week: dashboard.week.map(({ day, practiced }) => ({ day, practiced })),
  fragile: dashboard.fragile.map((entry) => ({
    entryId: entry.entryId,
    courseId: entry.courseId,
    courseName: entry.courseName,
    targetText: entry.targetText,
    nativeText: entry.nativeText,
    failures: entry.failures,
  })),
});

// Everyone shares the instance's time zone, so "today" and the streak mean
// the same days as in the app.
const overview = Effect.gen(function* () {
  const member = yield* CurrentMember;
  return yield* runIn(
    dashboardRuntime,
    Effect.flatMap(DashboardService, (service) =>
      service.progress(member.userId, serverEnv.ownerTimeZone()),
    ),
  );
});

export const overviewApi = HttpApiBuilder.group(
  WordholdApi,
  'overview',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle('courses', () =>
          Effect.map(overview, ({ courses, dashboard }) => {
            const stats = new Map(
              dashboard.perCourse.map((course) => [course.courseId, course]),
            );
            return courses.map((course) =>
              toApiCourse(course, stats.get(course.id)),
            );
          }),
        )
        .handle('progress', () =>
          Effect.map(overview, ({ dashboard }) => toApiProgress(dashboard)),
        ),
    ),
);
