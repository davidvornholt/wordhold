import { describe, expect, it } from 'bun:test';
import type { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import {
  dueEntryId,
  fixtureBookId,
  fixtureCourseId,
  fixtureOwnerId,
  fixtureUnitId,
  seedIntroducedCardFixture,
} from '../testing/introduced-card-fixture';
import { seedOwner } from '../testing/owner-fixture';
import { assertOwned, ownedEntryIds } from './ownership';

const otherOwnerId = 'other-owner';
const missingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const runWithFixture = <A, E>(work: Effect.Effect<A, E, Database>) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.andThen(
        Effect.all([seedIntroducedCardFixture, seedOwner(otherOwnerId)]),
        work,
      ).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

const outcome = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.as('owned'),
    Effect.catch((failure) => Effect.succeed(failure._tag)),
  );

describe('assertOwned', () => {
  it('accepts records from the person’s own courses, repeated or not', async () => {
    await runWithFixture(
      Effect.gen(function* () {
        expect(
          yield* outcome(
            assertOwned(fixtureOwnerId, {
              courses: [fixtureCourseId],
              books: [fixtureBookId],
              units: [fixtureUnitId],
              entries: [dueEntryId, dueEntryId],
              pages: [],
            }),
          ),
        ).toBe('owned');
      }),
    );
  });

  it('reports another person’s, missing and malformed records as not found', async () => {
    await runWithFixture(
      Effect.gen(function* () {
        expect(
          yield* outcome(
            assertOwned(otherOwnerId, { courses: [fixtureCourseId] }),
          ),
        ).toBe('NotOwnedError');
        expect(
          yield* outcome(
            assertOwned(fixtureOwnerId, { entries: [dueEntryId, missingId] }),
          ),
        ).toBe('NotOwnedError');
        expect(
          yield* outcome(assertOwned(fixtureOwnerId, { units: ['unit-1'] })),
        ).toBe('NotOwnedError');
      }),
    );
  });
});

describe('ownedEntryIds', () => {
  it('keeps only the person’s own entries', async () => {
    await runWithFixture(
      Effect.gen(function* () {
        expect(
          yield* ownedEntryIds(fixtureOwnerId, [
            dueEntryId,
            missingId,
            'not-a-uuid',
            dueEntryId,
          ]),
        ).toEqual([dueEntryId]);
        expect(yield* ownedEntryIds(otherOwnerId, [dueEntryId])).toEqual([]);
      }),
    );
  });
});
