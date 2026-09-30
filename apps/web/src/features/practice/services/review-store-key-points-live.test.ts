import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  firstReviewEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeReviewStore } from './review-store';

const storedKeyPoints = Effect.gen(function* () {
  const sql = yield* Database;
  const [row] = yield* sql<{
    readonly keyPoints: ReadonlyArray<string> | null;
  }>`select key_points as "keyPoints" from entries where id = ${firstReviewEntryId}`;
  return row?.keyPoints;
});

it('stores derived key points only for the definition they came from', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* PracticeReviewStore;
        yield* sql`update entries set native_text = 'Stoff, der Reaktionen beschleunigt' where id = ${firstReviewEntryId}`;

        expect(
          yield* store.saveKeyPoints(
            firstReviewEntryId,
            'eine ältere Definition',
            ['ist ein Stoff'],
          ),
        ).toBeNull();
        expect(yield* storedKeyPoints).toBeNull();

        const keyPoints = [
          'ist ein Stoff',
          'senkt die Aktivierungsenergie, "nicht" verbraucht',
          "{beschleunigt} die Reaktion's Ablauf",
        ];
        expect(
          yield* store.saveKeyPoints(
            firstReviewEntryId,
            'Stoff, der Reaktionen beschleunigt',
            keyPoints,
          ),
        ).toEqual(keyPoints);
        expect(yield* storedKeyPoints).toEqual(keyPoints);

        // Points the learner already has are never replaced by a late
        // derivation, which is told the points to grade against instead.
        expect(
          yield* store.saveKeyPoints(
            firstReviewEntryId,
            'Stoff, der Reaktionen beschleunigt',
            ['etwas anderes'],
          ),
        ).toEqual(keyPoints);
        expect(yield* storedKeyPoints).toEqual(keyPoints);
      }).pipe(
        Effect.provide(
          Layer.merge(
            PracticeReviewStore.live.pipe(Layer.provide(databaseLayer)),
            databaseLayer,
          ),
        ),
      );
    }),
  );
});
