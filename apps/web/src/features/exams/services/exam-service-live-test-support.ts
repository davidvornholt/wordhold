import type { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  firstReviewEntryId,
  fixtureCourseId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { ExamService } from './exam-service';
import { ExamStore } from './exam-store';

// Runs the program against a fresh migrated database seeded with the
// introduced-card fixture.
export const runExamTest = <A, E>(
  program: Effect.Effect<A, E, Database | ExamService>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.andThen(seedIntroducedCardFixture, program).pipe(
        Effect.provide(
          ExamService.layer.pipe(
            Layer.provide(ExamStore.live.pipe(Layer.provide(databaseLayer))),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

// The fixture's two introduced words, asked both ways: four learned cards.
export const createLearnedExam = (name = 'Vokabeltest') =>
  Effect.flatMap(ExamService, (service) =>
    service.create({
      courseId: fixtureCourseId,
      name,
      directions: ['to_target', 'to_native'],
      entryIds: [dueEntryId, firstReviewEntryId],
    }),
  );
