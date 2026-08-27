import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';
import {
  type CourseDirectionsData,
  decodeStoredDirections,
} from '../schemas/course-directions';
import type { CourseUnit, UnitWord } from '../schemas/course-units';

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
    ) => Effect.Effect<ReadonlyArray<CourseUnit>, CourseDatabaseError>;
    readonly listWords: (
      unitId: string,
    ) => Effect.Effect<ReadonlyArray<UnitWord>, CourseDatabaseError>;
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
      // A word remains unlearned until every card behind it is introduced.
      const listUnits = (courseId: string) =>
        sql<CourseUnit>`
          select u.id, u.name,
            count(distinct e.id)::int as words,
            count(distinct e.id) filter (
              where not coalesce(c.learned, false)
            )::int as unlearned
          from units u
          left join entries e on e.unit_id = u.id
          left join (
            select entry_id,
              count(*) = cardinality(enum_range(null::answer_direction))
                and bool_and(introduced_at is not null) as learned
            from cards group by entry_id
          ) c on c.entry_id = e.id
          where u.course_id = ${courseId}
          group by u.id
          order by u.position, u.name, u.id
        `.pipe(Effect.mapError((cause) => databaseError('list units', cause)));
      // A word counts as learned only once both of its cards have been
      // introduced, which is how the learning pass stamps them. An entry
      // without cards has met nobody, so the missing aggregate reads false.
      const listWords = (unitId: string) =>
        sql<UnitWord>`
          select e.id,
            e.target_text as "targetText",
            e.native_text as "nativeText",
            coalesce(
              count(c.id) = cardinality(enum_range(null::answer_direction))
                and bool_and(c.introduced_at is not null),
              false
            ) as learned
          from entries e
          left join cards c on c.entry_id = e.id
          where e.unit_id = ${unitId}
          group by e.id
          order by e.created_at, e.target_text, e.id
        `.pipe(Effect.mapError((cause) => databaseError('list words', cause)));
      return { readDirections, writeDirections, listUnits, listWords } as const;
    }),
  );
}
