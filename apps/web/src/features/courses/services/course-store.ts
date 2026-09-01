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
import { makeCourseUnitMutations } from './course-unit-mutations';
import { type CourseUnitRow, courseUnitFromRow } from './course-unit-rows';

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Kurs konnte nicht geladen werden.',
  });

type CreateUnitResult = 'created' | 'duplicate' | 'course-missing';

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
    readonly createUnit: (
      courseId: string,
      name: string,
    ) => Effect.Effect<CreateUnitResult, CourseDatabaseError>;
    readonly reorderUnits: (
      courseId: string,
      expectedUnitIds: ReadonlyArray<string>,
      unitIds: ReadonlyArray<string>,
    ) => Effect.Effect<boolean, CourseDatabaseError>;
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
        sql<CourseUnitRow>`
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
            ) as "nextDueAt",
            'to_target' = any(co.directions) as "toTargetEnabled",
            count(cards.id) filter (
              where cards.direction = 'to_target'
            )::int as "toTargetTotal",
            count(cards.id) filter (
              where cards.direction = 'to_target'
                and cards.introduced_at is not null
            )::int as "toTargetIntroduced",
            count(cards.id) filter (
              where cards.direction = 'to_target'
                and cards.introduced_at is null
            )::int as "toTargetUnintroduced",
            count(cards.id) filter (
              where cards.direction = 'to_target'
                and cards.introduced_at is not null
                and cards.state <> 'new' and cards.due_at <= ${now}
            )::int as "toTargetDue",
            count(cards.id) filter (
              where cards.direction = 'to_target'
                and cards.introduced_at is not null
                and cards.state = 'new'
            )::int as "toTargetFirstReviews",
            min(cards.due_at) filter (
              where cards.direction = 'to_target'
                and cards.introduced_at is not null
                and cards.due_at > ${now}
            ) as "toTargetNextDueAt",
            'to_native' = any(co.directions) as "toNativeEnabled",
            count(cards.id) filter (
              where cards.direction = 'to_native'
            )::int as "toNativeTotal",
            count(cards.id) filter (
              where cards.direction = 'to_native'
                and cards.introduced_at is not null
            )::int as "toNativeIntroduced",
            count(cards.id) filter (
              where cards.direction = 'to_native'
                and cards.introduced_at is null
            )::int as "toNativeUnintroduced",
            count(cards.id) filter (
              where cards.direction = 'to_native'
                and cards.introduced_at is not null
                and cards.state <> 'new' and cards.due_at <= ${now}
            )::int as "toNativeDue",
            count(cards.id) filter (
              where cards.direction = 'to_native'
                and cards.introduced_at is not null
                and cards.state = 'new'
            )::int as "toNativeFirstReviews",
            min(cards.due_at) filter (
              where cards.direction = 'to_native'
                and cards.introduced_at is not null
                and cards.due_at > ${now}
            ) as "toNativeNextDueAt"
          from units u
          join courses co on co.id = u.course_id
          left join entries e on e.unit_id = u.id
          left join cards on cards.entry_id = e.id
          where u.course_id = ${courseId}
          group by u.id, co.directions
          order by u.position, u.name, u.id
        `.pipe(
          Effect.map((rows) => rows.map(courseUnitFromRow)),
          Effect.mapError((cause) => databaseError('list units', cause)),
        );
      const { createUnit, reorderUnits } = makeCourseUnitMutations(sql);
      const listVocabulary = (courseId: string) =>
        sql<VocabularyRow>`
          select e.id, e.unit_id as "unitId", u.name as "unitName",
            e.target_text as "targetText", e.native_text as "nativeText",
            example.target_text as "exampleTargetText",
            example.native_text as "exampleNativeText",
            example.source as "exampleSource",
            c.id as "cardId", c.direction, c.state,
            c.due_at as "dueAt", c.introduced_at as "introducedAt",
            (select count(*)::int from reviews r
              where r.card_id = c.id and r.rating = 1) as failures
          from entries e
          join units u on u.id = e.unit_id
          join cards c on c.entry_id = e.id
          left join lateral (
            select target_text, native_text, source
            from entry_examples
            where entry_id = e.id
            order by position, id
            limit 1
          ) example on true
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
        createUnit,
        reorderUnits,
        listVocabulary,
      } as const;
    }),
  );
}
