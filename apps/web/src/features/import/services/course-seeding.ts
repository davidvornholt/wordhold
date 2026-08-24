import { Effect } from 'effect';

type CourseSeedOperations<Course, Failure> = {
  readonly list: Effect.Effect<ReadonlyArray<Course>, Failure>;
  readonly insertSeeds: Effect.Effect<ReadonlyArray<Course>, Failure>;
};

export const listOrSeedCourses = <Course, Failure>(
  operations: CourseSeedOperations<Course, Failure>,
): Effect.Effect<ReadonlyArray<Course>, Failure> =>
  operations.list.pipe(
    Effect.flatMap((existing) =>
      existing.length > 0 ? Effect.succeed(existing) : operations.insertSeeds,
    ),
  );
