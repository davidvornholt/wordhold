import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureNow,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import {
  fixtureSynonyms,
  seedDueSynonymCard,
} from '../../../shared/testing/relation-card-fixture';
import { PracticeSessionStore } from './session-store';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | PracticeSessionStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(
          PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

describe('PracticeSessionStore synonym and antonym cards', () => {
  it('asks a due synonym card with its words until the course switches them off', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        yield* seedDueSynonymCard;
        const sql = yield* Database;
        const store = yield* PracticeSessionStore;

        const synonyms = yield* store.loadScheduled(
          fixtureCourseId,
          'to_synonym',
          null,
          fixtureNow,
        );
        expect(synonyms.items).toMatchObject([
          {
            direction: 'to_synonym',
            entryId: dueEntryId,
            targetText: 'mémoire',
            relatedWords: fixtureSynonyms,
            entryKnown: true,
          },
        ]);
        const mixed = yield* store.loadScheduled(
          fixtureCourseId,
          'both',
          null,
          fixtureNow,
        );
        expect(
          mixed.items
            .filter((item) => item.entryId === dueEntryId)
            .map(({ direction, relatedWords }) => [direction, relatedWords]),
        ).toEqual([
          ['to_target', []],
          ['to_synonym', fixtureSynonyms],
        ]);

        yield* sql`
          update courses set practises_related_words = false
          where id = ${fixtureCourseId}
        `;
        const switchedOff = yield* store.loadScheduled(
          fixtureCourseId,
          'to_synonym',
          null,
          fixtureNow,
        );
        expect(switchedOff.items).toEqual([]);
        expect(switchedOff.availability.ready).toBe(0);
        const mixedOff = yield* store.loadScheduled(
          fixtureCourseId,
          'both',
          null,
          fixtureNow,
        );
        expect(mixedOff.items.map((item) => item.direction)).not.toContain(
          'to_synonym',
        );
      }),
    );
  });

  it('counts a word as sicher only once its synonym card is learned too', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        yield* seedDueSynonymCard;
        const sql = yield* Database;
        const store = yield* PracticeSessionStore;
        const dueWordKnown = Effect.map(
          store.loadScheduled(fixtureCourseId, 'to_target', null, fixtureNow),
          (session) =>
            session.items.find((item) => item.entryId === dueEntryId)
              ?.entryKnown,
        );

        yield* sql`
          update cards set state = 'relearning'
          where entry_id = ${dueEntryId} and direction = 'to_synonym'
        `;
        expect(yield* dueWordKnown).toBe(false);
        yield* sql`
          update courses set practises_related_words = false
          where id = ${fixtureCourseId}
        `;
        expect(yield* dueWordKnown).toBe(true);
      }),
    );
  });
});
