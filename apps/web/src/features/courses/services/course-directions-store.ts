import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { CourseSettingsDatabaseError } from '../errors/courses-errors';
import {
  type CourseDirectionsData,
  decodeStoredDirections,
} from '../schemas/course-directions';

const databaseError = (operation: string, cause: unknown) =>
  new CourseSettingsDatabaseError({
    operation,
    cause,
    message: 'Die Kurseinstellungen konnten nicht geladen werden.',
  });

export class CourseDirectionsStore extends Context.Tag(
  'wordhold/CourseDirectionsStore',
)<
  CourseDirectionsStore,
  {
    readonly read: (
      courseId: string,
    ) => Effect.Effect<
      CourseDirectionsData | undefined,
      CourseSettingsDatabaseError
    >;
    // Resolves false when no course carries that id.
    readonly write: (
      courseId: string,
      directions: CourseDirectionsData,
    ) => Effect.Effect<boolean, CourseSettingsDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    CourseDirectionsStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      // The column is unnested into one row per direction rather than read as
      // an array: the Postgres driver hands an array column back as the raw
      // text `{to_target,to_native}`, so a query that returns rows is the only
      // one whose shape this code decides. No rows means no such course.
      const read = (
        courseId: string,
      ): Effect.Effect<
        CourseDirectionsData | undefined,
        CourseSettingsDatabaseError
      > =>
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
      const write = (courseId: string, directions: CourseDirectionsData) =>
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
      return { read, write } as const;
    }),
  );
}
