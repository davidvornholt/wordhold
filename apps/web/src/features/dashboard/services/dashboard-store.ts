import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { earliestDate } from '../../../shared/dates/learning-date';
import { ratings } from '../../../shared/grading/rating';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { DashboardDatabaseError } from '../errors/dashboard-errors';
import type { CourseStats, FragileEntry } from '../schemas/dashboard-models';

const fragileWindowDays = 30;
const fragileMinFailures = 2;
const fragileLimit = 8;

type CountRow = { readonly courseId: string; readonly count: number };
type CardCountRow = {
  readonly courseId: string;
  readonly direction: 'to_target' | 'to_native';
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};
type MutableCourseStats = {
  due: number;
  firstReviews: number;
  unintroduced: number;
  entries: number;
  directions: Array<CardCountRow & { readonly ready: number }>;
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
    readonly fragileEntries: () => Effect.Effect<
      ReadonlyArray<FragileEntry>,
      DashboardDatabaseError
    >;
    readonly activityBetween: (
      startInclusive: Date,
      endExclusive: Date,
    ) => Effect.Effect<
      { readonly answers: number; readonly cards: number },
      DashboardDatabaseError
    >;
  }
>() {
  static readonly live = Layer.effect(
    DashboardStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const courseCounts = (now: Date) =>
        Effect.all(
          {
            cards: sql<CardCountRow>`
              select co.id as "courseId", d.direction,
                count(c.id) filter (
                  where c.state <> 'new' and c.due_at is not null
                    and c.due_at <= ${now}
                )::int as due,
                count(c.id) filter (where c.state = 'new')::int as "firstReviews",
                min(c.due_at) filter (where c.due_at > ${now}) as "nextDueAt"
              from courses co
              cross join lateral unnest(co.directions) as d(direction)
              left join entries e on e.course_id = co.id
              left join cards c on c.entry_id = e.id
                and c.direction = d.direction
                and c.introduced_at is not null
              group by co.id, d.direction
            `,
            // Counted per entry for the CTA, but only across enabled card
            // directions. Enabling a direction later makes its untouched
            // entries available for a new learning pass.
            unintroduced: sql<CountRow>`
              select e.course_id as "courseId", count(distinct e.id)::int as count
              from entries e
              join courses co on co.id = e.course_id
              where exists (
                select 1 from cards c
                where c.entry_id = e.id
                  and c.direction = any(co.directions)
                  and c.introduced_at is null
              )
              group by e.course_id
            `,
            entries: sql<CountRow>`
              select course_id as "courseId", count(*)::int as count
              from entries group by course_id
            `,
          },
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.map(({ cards, unintroduced, entries }) => {
            const counts = new Map<string, MutableCourseStats>();
            const slot = (courseId: string) => {
              const existing = counts.get(courseId);
              if (existing !== undefined) {
                return existing;
              }
              const created = {
                due: 0,
                firstReviews: 0,
                unintroduced: 0,
                entries: 0,
                directions: [],
              };
              counts.set(courseId, created);
              return created;
            };
            for (const row of cards) {
              const course = slot(row.courseId);
              course.due += row.due;
              course.firstReviews += row.firstReviews;
              course.directions.push({
                ...row,
                ready: readyCardsInNextSection(row.due, row.firstReviews),
              });
            }
            for (const row of unintroduced) {
              slot(row.courseId).unintroduced = row.count;
            }
            for (const row of entries) {
              slot(row.courseId).entries = row.count;
            }
            return [...counts].map(([courseId, value]) => {
              const { directions, ...totals } = value;
              return {
                courseId,
                ...totals,
                ready: readyCardsInNextSection(value.due, value.firstReviews),
                nextDueAt: earliestDate(
                  directions.map((direction) => direction.nextDueAt),
                ),
                directions,
              };
            });
          }),
          Effect.mapError(databaseError),
        );
      const fragileEntries = () =>
        sql<FragileEntry>`
          select e.id as "entryId", e.course_id as "courseId",
            e.target_text as "targetText",
            e.native_text as "nativeText", co.name as "courseName",
            count(*)::int as failures
          from reviews r
          join cards c on c.id = r.card_id
          join entries e on e.id = c.entry_id
          join courses co on co.id = e.course_id
          where r.rating = ${ratings.again}
            and c.direction = any(co.directions)
            and r.reviewed_at >= now() - make_interval(days => ${fragileWindowDays})
          group by e.id, e.target_text, e.native_text, co.name
          having count(*) >= ${fragileMinFailures}
          order by failures desc limit ${fragileLimit}
        `.pipe(Effect.mapError(databaseError));
      const activityBetween = (startInclusive: Date, endExclusive: Date) =>
        sql<{ readonly answers: number; readonly cards: number }>`
          select count(*)::int as answers,
            count(distinct card_id)::int as cards
          from reviews
          where reviewed_at >= ${startInclusive} and reviewed_at < ${endExclusive}
        `.pipe(
          Effect.map((rows) => rows[0] ?? { answers: 0, cards: 0 }),
          Effect.mapError(databaseError),
        );
      return { courseCounts, fragileEntries, activityBetween } as const;
    }),
  );
}
