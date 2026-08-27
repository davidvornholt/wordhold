import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import { DashboardDatabaseError } from '../errors/dashboard-errors';
import type { CourseStats, FragileWord } from '../schemas/dashboard-models';

const fragileWindowDays = 30;
const fragileMinFailures = 2;
const fragileLimit = 8;

type CountRow = { readonly courseId: string; readonly count: number };
type MutableCourseStats = {
  due: number;
  fresh: number;
  unlearned: number;
  words: number;
};

const databaseError = (cause: unknown) =>
  new DashboardDatabaseError({
    cause,
    message: 'Die Übersicht konnte nicht geladen werden.',
  });

export class DashboardStore extends Context.Tag('wordhold/DashboardStore')<
  DashboardStore,
  {
    readonly courseCounts: (
      now: Date,
    ) => Effect.Effect<ReadonlyArray<CourseStats>, DashboardDatabaseError>;
    readonly fragileWords: () => Effect.Effect<
      ReadonlyArray<FragileWord>,
      DashboardDatabaseError
    >;
    readonly reviewsBetween: (
      startInclusive: Date,
      endExclusive: Date,
    ) => Effect.Effect<number, DashboardDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    DashboardStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const courseCounts = (now: Date) =>
        Effect.all(
          {
            // "Due" and "new" both mean a card the practice session would
            // offer. It offers nothing that has not been learned first, and
            // nothing in a direction the course has switched off.
            due: sql<CountRow>`
              select e.course_id as "courseId", count(*)::int as count
              from cards c join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where c.introduced_at is not null and c.state <> 'new'
                and c.direction = any(co.directions)
                and c.due_at is not null and c.due_at <= ${now}
              group by e.course_id
            `,
            fresh: sql<CountRow>`
              select e.course_id as "courseId", count(*)::int as count
              from cards c join entries e on e.id = c.entry_id
              join courses co on co.id = e.course_id
              where c.introduced_at is not null and c.state = 'new'
                and c.direction = any(co.directions)
              group by e.course_id
            `,
            // Counted per word, not per card: the learning pass introduces
            // both directions of a word together, and "12 zu lernen" means
            // twelve words to work through.
            unlearned: sql<CountRow>`
              select e.course_id as "courseId", count(distinct e.id)::int as count
              from cards c join entries e on e.id = c.entry_id
              where c.introduced_at is null group by e.course_id
            `,
            words: sql<CountRow>`
              select course_id as "courseId", count(*)::int as count
              from entries group by course_id
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ due, fresh, unlearned, words }) => {
            const counts = new Map<string, MutableCourseStats>();
            const slot = (courseId: string) => {
              const existing = counts.get(courseId);
              if (existing !== undefined) {
                return existing;
              }
              const created = { due: 0, fresh: 0, unlearned: 0, words: 0 };
              counts.set(courseId, created);
              return created;
            };
            for (const row of due) {
              slot(row.courseId).due = row.count;
            }
            for (const row of fresh) {
              slot(row.courseId).fresh = row.count;
            }
            for (const row of unlearned) {
              slot(row.courseId).unlearned = row.count;
            }
            for (const row of words) {
              slot(row.courseId).words = row.count;
            }
            return [...counts].map(([courseId, value]) => ({
              courseId,
              ...value,
            }));
          }),
          Effect.mapError(databaseError),
        );
      const fragileWords = () =>
        sql<FragileWord>`
          select e.id as "entryId", e.target_text as "targetText",
            e.native_text as "nativeText", co.name as "courseName",
            count(*)::int as failures
          from reviews r
          join cards c on c.id = r.card_id
          join entries e on e.id = c.entry_id
          join courses co on co.id = e.course_id
          where r.rating = ${ratings.again}
            and r.reviewed_at >= now() - make_interval(days => ${fragileWindowDays})
          group by e.id, e.target_text, e.native_text, co.name
          having count(*) >= ${fragileMinFailures}
          order by failures desc limit ${fragileLimit}
        `.pipe(Effect.mapError(databaseError));
      const reviewsBetween = (startInclusive: Date, endExclusive: Date) =>
        sql<{ readonly count: number }>`
          select count(*)::int as count from reviews
          where reviewed_at >= ${startInclusive} and reviewed_at < ${endExclusive}
        `.pipe(
          Effect.map((rows) => rows[0]?.count ?? 0),
          Effect.mapError(databaseError),
        );
      return { courseCounts, fragileWords, reviewsBetween } as const;
    }),
  );
}
