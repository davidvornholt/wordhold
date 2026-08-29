import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';
import {
  type CourseDirectionsData,
  decodeStoredDirections,
} from '../schemas/course-directions';
import type { CourseUnit, VocabularyEntry } from '../schemas/course-units';
import {
  groupVocabularyRows,
  type VocabularyRow,
} from '../schemas/vocabulary-rows';

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Kurs konnte nicht geladen werden.',
  });

export class CourseStore extends Context.Tag('wordhold/CourseStore')<
  CourseStore,
  {
    readonly readDirections: (
      courseId: string,
    ) => Effect.Effect<CourseDirectionsData | undefined, CourseDatabaseError>;
    // Resolves false when no course carries that id.
    readonly writeDirections: (
      courseId: string,
      directions: CourseDirectionsData,
    ) => Effect.Effect<boolean, CourseDatabaseError>;
    readonly listUnits: (
      courseId: string,
      now: Date,
    ) => Effect.Effect<ReadonlyArray<CourseUnit>, CourseDatabaseError>;
    readonly listVocabulary: (
      courseId: string,
    ) => Effect.Effect<ReadonlyArray<VocabularyEntry>, CourseDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    CourseStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      // The column is unnested into one row per direction rather than read as
      // an array: the Postgres driver hands an array column back as the raw
      // text `{to_target,to_native}`, so a query that returns rows is the only
      // one whose shape this code decides. No rows means no such course.
      const readDirections = (
        courseId: string,
      ): Effect.Effect<CourseDirectionsData | undefined, CourseDatabaseError> =>
        sql<{ readonly direction: unknown }>`
          select d.direction
          from courses c
          left join lateral unnest(c.directions) as d(direction) on true
          where c.id = ${courseId}
        `.pipe(
          Effect.mapError((cause) =>
            databaseError('read course directions', cause),
          ),
          Effect.flatMap((rows) =>
            rows.length === 0
              ? Effect.succeed(undefined)
              : decodeStoredDirections(rows.map((row) => row.direction)).pipe(
                  Effect.mapError((cause) =>
                    databaseError('read course directions', cause),
                  ),
                ),
          ),
        );
      // The array is written as one text literal rather than as a parameter
      // per element: the values are enum names the schema already validated,
      // and this keeps the driver out of deciding how an array is shaped.
      const writeDirections = (
        courseId: string,
        directions: CourseDirectionsData,
      ) =>
        sql<{ readonly id: string }>`
          update courses
          set directions = ${`{${directions.join(',')}}`}::answer_direction[]
          where id = ${courseId}
          returning id
        `.pipe(
          Effect.map((rows) => rows.at(0) !== undefined),
          Effect.mapError((cause) =>
            databaseError('write course directions', cause),
          ),
        );
      // An entry remains unintroduced while one of the course's enabled
      // directions has not been introduced. A disabled direction stays out of
      // the learner's way until it is enabled again.
      const listUnits = (courseId: string, now: Date) =>
        sql<CourseUnit>`
          select u.id, u.name,
            count(distinct e.id)::int as entries,
            count(distinct e.id) filter (
              where exists (
                select 1 from cards met
                where met.entry_id = e.id
                  and met.introduced_at is not null
              )
            )::int as introduced,
            count(distinct e.id) filter (
              where exists (
                select 1 from cards pending
                where pending.entry_id = e.id
                  and pending.direction = any(co.directions)
                  and pending.introduced_at is null
              )
            )::int as unintroduced,
            count(cards.id) filter (
              where cards.introduced_at is not null
                and cards.direction = any(co.directions)
                and cards.state <> 'new' and cards.due_at <= ${now}
            )::int as due,
            count(cards.id) filter (
              where cards.introduced_at is not null
                and cards.direction = any(co.directions)
                and cards.state = 'new'
            )::int as "firstReviews",
            min(cards.due_at) filter (
              where cards.introduced_at is not null
                and cards.direction = any(co.directions)
                and cards.due_at > ${now}
            ) as "nextDueAt"
          from units u
          join courses co on co.id = u.course_id
          left join entries e on e.unit_id = u.id
          left join cards on cards.entry_id = e.id
          where u.course_id = ${courseId}
          group by u.id, co.directions
          order by u.position, u.name, u.id
        `.pipe(Effect.mapError((cause) => databaseError('list units', cause)));
      const listVocabulary = (courseId: string) =>
        sql<VocabularyRow>`
          select e.id, e.unit_id as "unitId", u.name as "unitName",
            e.target_text as "targetText", e.native_text as "nativeText",
            c.id as "cardId", c.direction, c.state,
            c.due_at as "dueAt", c.introduced_at as "introducedAt",
            (select count(*)::int from reviews r
              where r.card_id = c.id and r.rating = 1) as failures
          from entries e
          join units u on u.id = e.unit_id
          join cards c on c.entry_id = e.id
          where e.course_id = ${courseId}
          order by u.position, e.created_at, e.target_text, c.direction
        `.pipe(
          Effect.map(groupVocabularyRows),
          Effect.mapError((cause) => databaseError('list vocabulary', cause)),
        );
      return {
        readDirections,
        writeDirections,
        listUnits,
        listVocabulary,
      } as const;
    }),
  );
}
