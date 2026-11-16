import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId as courseId,
  firstReviewEntryId as entryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { VocabularyEntryStore } from './vocabulary-entry-store';
import { VocabularyExampleStore } from './vocabulary-example-store';

type Stores = VocabularyEntryStore | VocabularyExampleStore;

const word = { targetText: 'livre', nativeText: 'Buch' };
const example = {
  targetText: 'Je lis un livre.',
  nativeText: 'Ich lese ein Buch.',
};

const run = <A, E>(effect: Effect.Effect<A, E, Database | Stores>) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        return yield* effect;
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            VocabularyEntryStore.live,
            VocabularyExampleStore.live,
          ),
        ),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const revisionOf = Effect.gen(function* () {
  const sql = yield* Database;
  const [row] = yield* sql<{ readonly revision: number }>`
    select revision from entries where id = ${entryId}
  `;
  return row?.revision ?? -1;
});

const storedExample = Effect.gen(function* () {
  const sql = yield* Database;
  const [row] = yield* sql<{
    readonly targetText: string;
    readonly nativeText: string | null;
    readonly audioPath: string | null;
  }>`
    select target_text as "targetText", native_text as "nativeText",
      audio_path as "audioPath"
    from entry_examples where entry_id = ${entryId}
  `;
  return row;
});

// What an editor loaded at `revision` sends back for the word, with the
// example it showed (none, when it was opened before one existed).
const saveFrom = (
  revision: number,
  shown?: { readonly targetText: string; readonly nativeText: string | null },
) =>
  Effect.flatMap(VocabularyEntryStore, (store) =>
    store.update({
      courseId,
      entryId,
      revision,
      ...word,
      synonyms: null,
      antonyms: null,
      ...(shown === undefined
        ? {}
        : { example: { ...shown, source: 'generated' as const } }),
    }),
  ).pipe(Effect.map((result) => result.kind));

const generate = Effect.flatMap(VocabularyExampleStore, (store) =>
  store.storeGenerated({ entryId, ...word }, example),
);

// An example as an earlier generation left it, so the revision stays as it was.
const seedExample = (nativeText: string | null) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* sql`
      insert into entry_examples (entry_id, target_text, native_text, source, position)
      values (${entryId}, ${example.targetText}, ${nativeText}, 'generated', 0)
    `;
  });

describe('saving a word from an editor loaded before an example was written', () => {
  it('refuses the older editor after an example was generated and keeps it', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const loaded = yield* revisionOf;
        yield* generate;
        const refused = yield* saveFrom(loaded);
        return {
          refused,
          revision: yield* revisionOf,
          stored: yield* storedExample,
        };
      }),
    );
    expect(outcome.refused).toBe('stale');
    expect(outcome.revision).toBe(1);
    expect(outcome.stored?.targetText).toBe(example.targetText);
  });

  it('refuses the older editor after the example got its translation', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* VocabularyExampleStore;
        yield* seedExample(null);
        const loaded = yield* revisionOf;
        const stored = yield* store.storeTranslation(
          entryId,
          example.targetText,
          example.nativeText,
        );
        const refused = yield* saveFrom(loaded, {
          targetText: example.targetText,
          nativeText: null,
        });
        return {
          stored,
          refused,
          revision: yield* revisionOf,
          example: yield* storedExample,
        };
      }),
    );
    expect(outcome.stored).toBe(true);
    expect(outcome.refused).toBe('stale');
    expect(outcome.revision).toBe(1);
    expect(outcome.example?.nativeText).toBe(example.nativeText);
  });

  it('refuses the older editor after the example got its audio', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* VocabularyExampleStore;
        yield* seedExample(example.nativeText);
        const loaded = yield* revisionOf;
        const stored = yield* store.storeAudio(
          entryId,
          example.targetText,
          'synthetic-profile',
          'synthetic/audio.mp3',
        );
        const refused = yield* saveFrom(loaded, example);
        return { stored, refused, revision: yield* revisionOf };
      }),
    );
    expect(outcome).toEqual({ stored: true, refused: 'stale', revision: 1 });
  });
});

describe('saving a word after an example write', () => {
  it('lets an editor loaded after the write save', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        yield* generate;
        const reloaded = yield* revisionOf;
        return yield* saveFrom(reloaded, {
          ...example,
          nativeText: 'Ich lese ein Buch!',
        });
      }),
    );
    expect(outcome).toBe('updated');
  });

  it('leaves the revision alone when a write changes nothing', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* VocabularyExampleStore;
        yield* seedExample(example.nativeText);
        const loaded = yield* revisionOf;
        // The entry already has an example, so a second generation keeps it.
        yield* generate;
        // The translation is there already, so it is not written again.
        const translated = yield* store.storeTranslation(
          entryId,
          example.targetText,
          'Another translation',
        );
        // Another sentence than the stored one is not written either.
        const audioOfOther = yield* store.storeAudio(
          entryId,
          'Another sentence.',
          'synthetic-profile',
          'synthetic/other.mp3',
        );
        const revision = yield* revisionOf;
        const saved = yield* saveFrom(loaded, example);
        return { translated, audioOfOther, revision, saved };
      }),
    );
    expect(outcome).toEqual({
      translated: false,
      audioOfOther: false,
      revision: 0,
      saved: 'updated',
    });
  });

  it('leaves the revision alone when the same audio is written again', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* VocabularyExampleStore;
        yield* seedExample(example.nativeText);
        yield* store.storeAudio(
          entryId,
          example.targetText,
          'synthetic-profile',
          'synthetic/audio.mp3',
        );
        const afterFirst = yield* revisionOf;
        yield* store.storeAudio(
          entryId,
          example.targetText,
          'synthetic-profile',
          'synthetic/audio.mp3',
        );
        return { afterFirst, afterSecond: yield* revisionOf };
      }),
    );
    expect(outcome).toEqual({ afterFirst: 1, afterSecond: 1 });
  });
});
