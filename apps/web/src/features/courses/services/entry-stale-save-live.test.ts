import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { TermEntryStore } from './term-entry-store';
import { TextEntryStore } from './text-entry-store';
import { VocabularyEntryStore } from './vocabulary-entry-store';

type Form = {
  readonly label: string;
  readonly wording: string;
  readonly revision: number;
};

// One course kind, as the editor of its entries sees it: the form it loads,
// and the save it sends.
type Kind = {
  readonly name: string;
  readonly courseKind: 'language' | 'terms' | 'texts';
  readonly create: (
    courseId: string,
    bookId: string,
  ) => Effect.Effect<string, unknown, Stores>;
  readonly save: (
    courseId: string,
    entryId: string,
    form: Form,
  ) => Effect.Effect<string, unknown, Stores>;
};

type Stores = VocabularyEntryStore | TermEntryStore | TextEntryStore;

const created = (result: {
  readonly kind: string;
  readonly entryId?: string;
}) =>
  result.kind === 'created' && result.entryId !== undefined
    ? Effect.succeed(result.entryId)
    : Effect.die(`The fixture was not created: ${result.kind}`);

const original = { label: 'Original label', wording: 'Original wording' };

const kinds: ReadonlyArray<Kind> = [
  {
    name: 'a word',
    courseKind: 'language',
    create: (courseId, bookId) =>
      Effect.flatMap(VocabularyEntryStore, (store) =>
        store.create({
          courseId,
          bookId,
          unitId: null,
          targetText: original.label,
          nativeText: original.wording,
        }),
      ).pipe(Effect.flatMap(created)),
    save: (courseId, entryId, form) =>
      Effect.flatMap(VocabularyEntryStore, (store) =>
        store.update({
          courseId,
          entryId,
          revision: form.revision,
          targetText: form.label,
          nativeText: form.wording,
          synonyms: null,
          antonyms: null,
        }),
      ).pipe(Effect.map((result) => result.kind)),
  },
  {
    name: 'a term',
    courseKind: 'terms',
    create: (courseId) =>
      Effect.flatMap(TermEntryStore, (store) =>
        store.create({
          courseId,
          term: original.label,
          definition: original.wording,
        }),
      ).pipe(Effect.flatMap(created)),
    save: (courseId, entryId, form) =>
      Effect.flatMap(TermEntryStore, (store) =>
        store.update({
          courseId,
          entryId,
          revision: form.revision,
          term: form.label,
          definition: form.wording,
        }),
      ).pipe(Effect.map((result) => result.kind)),
  },
  {
    name: 'a text',
    courseKind: 'texts',
    create: (courseId) =>
      Effect.flatMap(TextEntryStore, (store) =>
        store.create({
          courseId,
          title: original.label,
          text: original.wording,
        }),
      ).pipe(Effect.flatMap(created)),
    save: (courseId, entryId, form) =>
      Effect.flatMap(TextEntryStore, (store) =>
        store.update({
          courseId,
          entryId,
          revision: form.revision,
          title: form.label,
          text: form.wording,
        }),
      ).pipe(Effect.map((result) => result.kind)),
  },
];

const runStoreTest = <A, E>(effect: Effect.Effect<A, E, Database | Stores>) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(
        Effect.provide(
          Layer.mergeAll(
            VocabularyEntryStore.live,
            TermEntryStore.live,
            TextEntryStore.live,
          ),
        ),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

describe('saving an entry from an editor loaded before another save', () => {
  for (const kind of kinds) {
    it(`refuses the older editor of ${kind.name} and lets a reloaded one save`, async () => {
      const outcome = await runStoreTest(
        Effect.gen(function* () {
          const sql = yield* Database;
          const courseId = crypto.randomUUID();
          const bookId = crypto.randomUUID();
          yield* sql`
            insert into courses (id, name, kind, target_language, native_language, directions)
            values (${courseId}, 'Synthetic course', ${kind.courseKind}, 'de', 'de', '{to_native}')
          `;
          yield* sql`
            insert into books (id, course_id, name, position)
            values (${bookId}, ${courseId}, 'Synthetic book', 0)
          `;
          const entryId = yield* kind.create(courseId, bookId);
          const read = () =>
            sql<Form>`
              select target_text as label, native_text as wording, revision
              from entries where id = ${entryId}
            `.pipe(
              Effect.flatMap(([row]) =>
                row === undefined ? Effect.die('gone') : Effect.succeed(row),
              ),
            );
          // Two editors load the entry; the first one saves a corrected wording.
          const older = yield* read();
          const first = yield* kind.save(courseId, entryId, {
            ...older,
            wording: 'Corrected wording',
          });
          // The older editor still holds the old wording and renames the label.
          const refused = yield* kind.save(courseId, entryId, {
            ...older,
            label: 'Renamed label',
          });
          const afterRefusal = yield* read();
          const reloaded = yield* read();
          const accepted = yield* kind.save(courseId, entryId, {
            ...reloaded,
            label: 'Renamed label',
          });
          return {
            first,
            refused,
            afterRefusal,
            accepted,
            final: yield* read(),
          };
        }),
      );
      expect(outcome.first).toBe('updated');
      expect(outcome.refused).toBe('stale');
      expect(outcome.afterRefusal).toEqual({
        label: original.label,
        wording: 'Corrected wording',
        revision: 1,
      });
      expect(outcome.accepted).toBe('updated');
      expect(outcome.final).toEqual({
        label: 'Renamed label',
        wording: 'Corrected wording',
        revision: 2,
      });
    });
  }
});
