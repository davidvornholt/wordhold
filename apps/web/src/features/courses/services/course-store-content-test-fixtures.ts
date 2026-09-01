import type { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { CourseStore } from './course-store';

export const missingCourseId = '11111111-1111-4111-8111-111111111111';

export const emptyDirections = [
  {
    direction: 'to_target' as const,
    total: 0,
    introduced: 0,
    unintroduced: 0,
    due: 0,
    firstReviews: 0,
    nextDueAt: null,
  },
  {
    direction: 'to_native' as const,
    total: 0,
    introduced: 0,
    unintroduced: 0,
    due: 0,
    firstReviews: 0,
    nextDueAt: null,
  },
] as const;

export const initialDirections = [
  {
    direction: 'to_target' as const,
    total: 3,
    introduced: 2,
    unintroduced: 1,
    due: 1,
    firstReviews: 1,
    nextDueAt: null,
  },
  {
    direction: 'to_native' as const,
    total: 3,
    introduced: 2,
    unintroduced: 1,
    due: 0,
    firstReviews: 1,
    nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
  },
] as const;

export const directionsAfterTargetIntroduced = [
  {
    ...initialDirections[0],
    introduced: 3,
    unintroduced: 0,
    firstReviews: 2,
  },
  initialDirections[1],
] as const;

export const directionsAfterNativeRemoved = [
  directionsAfterTargetIntroduced[0],
  {
    ...initialDirections[1],
    total: 2,
    unintroduced: 0,
  },
] as const;

export const runCourseStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | CourseStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(CourseStore.live.pipe(Layer.provide(databaseLayer))),
        Effect.provide(databaseLayer),
      );
    }),
  );
