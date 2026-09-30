import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import type { NewExampleData } from '../../../shared/vocabulary/entry-fields';
import { VocabularyEntryStore } from './vocabulary-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bookId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherBookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const unitId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const practisedReps = 3;
const wordAudio = 'audio/word-old.mp3';
const exampleAudio = 'audio/example-old.mp3';

const example = {
  targetText: 'Ce voyage est un bon souvenir.',
  nativeText: 'Diese Reise ist eine schöne Erinnerung.',
  source: 'textbook',
} satisfies NewExampleData;

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | VocabularyEntryStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(VocabularyEntryStore.live),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedCourses = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr'), (${otherCourseId}, 'Spanish', 'es')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${courseId}, 'Découvertes 3', 0),
      (${otherBookId}, ${otherCourseId}, 'Encuentros 1', 0)
  `;
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${unitId}, ${courseId}, ${bookId}, 'Unité 1', 0)
  `;
});

// A word as it looks after some practice: its cards have a history, the
// judge accepted an alternative, and both the word and its example have
// pronunciation.
const practisedWord = (targetText: string, nativeText: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const store = yield* VocabularyEntryStore;
    const created = yield* store.create({
      courseId,
      bookId,
      unitId,
      targetText,
      nativeText,
      example,
    });
    const entryId = created.kind === 'created' ? created.entryId : '';
    yield* sql`update cards set reps = ${practisedReps} where entry_id = ${entryId}`;
    yield* sql`
      insert into reviews (card_id, rating, answer_text)
      select id, 3, ${targetText} from cards where entry_id = ${entryId}
    `;
    yield* sql`
      insert into accepted_answers
        (entry_id, direction, text, normalized, source)
      values (${entryId}, 'to_native', 'das Andenken', 'das andenken', 'judge'),
        (${entryId}, 'to_native', 'die Gedächtnis', 'die gedächtnis', 'manual')
    `;
    yield* store.storeAudio(entryId, 'remi', wordAudio);
    yield* sql`
      update entry_examples
      set audio_profile = 'remi', audio_path = ${exampleAudio}
      where entry_id = ${entryId}
    `;
    return entryId;
  });

const storedWord = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [entry] = yield* sql<{
      readonly targetText: string;
      readonly nativeText: string;
      readonly bookId: string;
      readonly unitId: string | null;
    }>`select target_text as "targetText", native_text as "nativeText", book_id as "bookId", unit_id as "unitId" from entries where id = ${entryId}`;
    const answers = yield* sql<{
      readonly text: string;
      readonly source: string;
    }>`select text, source from accepted_answers where entry_id = ${entryId} order by text`;
    const examples = yield* sql<{
      readonly targetText: string;
      readonly nativeText: string | null;
      readonly source: string;
      readonly audioPath: string | null;
    }>`select target_text as "targetText", native_text as "nativeText", source, audio_path as "audioPath" from entry_examples where entry_id = ${entryId}`;
    const audio = yield* sql<{
      readonly path: string;
    }>`select path from entry_audio where entry_id = ${entryId}`;
    const cards = yield* sql<{
      readonly reps: number;
    }>`select reps from cards where entry_id = ${entryId}`;
    const [reviews] = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from reviews r
      join cards c on c.id = r.card_id
      where c.entry_id = ${entryId}
    `;
    return {
      entry,
      answers,
      examples,
      audio: audio.map((row) => row.path),
      reps: cards.map((card) => card.reps),
      reviews: reviews?.count,
    };
  });

describe('VocabularyEntryStore corrections', () => {
  it('corrects a word in place and keeps its cards and their history', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire', 'die Erinnerung');
        const edit = { courseId, entryId, example };
        expect(
          yield* store.update({
            ...edit,
            targetText: 'le souvenir',
            nativeText: 'die Erinnerung',
          }),
        ).toEqual({
          kind: 'updated',
          wordChanged: true,
          unreferencedFiles: [wordAudio],
        });
        expect(yield* storedWord(entryId)).toEqual({
          entry: {
            targetText: 'le souvenir',
            nativeText: 'die Erinnerung',
            bookId,
            unitId,
          },
          // The judge's alternative was accepted for the old word; the
          // learner's own is kept.
          answers: [
            { text: 'die Erinnerung', source: 'textbook' },
            { text: 'die Gedächtnis', source: 'manual' },
            { text: 'le souvenir', source: 'textbook' },
          ],
          examples: [{ ...example, audioPath: exampleAudio }],
          audio: [],
          reps: [practisedReps, practisedReps],
          reviews: 2,
        });
      }),
    );
  });

  it('corrects, replaces, removes and adds the example sentence', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        const entryId = yield* practisedWord('la mémoire', 'die Erinnerung');
        const word = {
          courseId,
          entryId,
          targetText: 'la mémoire',
          nativeText: 'die Erinnerung',
        };
        const translated = { ...example, nativeText: 'Die Reise.' };
        expect(yield* store.update({ ...word, example: translated })).toEqual({
          kind: 'updated',
          wordChanged: false,
          unreferencedFiles: [],
        });
        expect((yield* storedWord(entryId)).examples).toEqual([
          { ...translated, audioPath: exampleAudio },
        ]);
        const replaced = {
          targetText: 'Il a une bonne mémoire.',
          nativeText: 'Er hat ein gutes Gedächtnis.',
          source: 'generated',
        } satisfies NewExampleData;
        expect(yield* store.update({ ...word, example: replaced })).toEqual({
          kind: 'updated',
          wordChanged: false,
          unreferencedFiles: [exampleAudio],
        });
        expect((yield* storedWord(entryId)).examples).toEqual([
          { ...replaced, audioPath: null },
        ]);
        yield* store.update(word);
        expect((yield* storedWord(entryId)).examples).toEqual([]);
        yield* store.update({ ...word, example });
        const stored = yield* storedWord(entryId);
        expect(stored.examples).toEqual([{ ...example, audioPath: null }]);
        // Unchanged texts keep every accepted answer and the pronunciation.
        expect(stored.answers.map((answer) => answer.source)).toContain(
          'judge',
        );
        expect(stored.audio).toEqual([wordAudio]);
      }),
    );
  });

  it('refuses an exact repeat of another word and a word of another course', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const store = yield* VocabularyEntryStore;
        yield* practisedWord('vous', 'ihr');
        const entryId = yield* practisedWord('merci', 'danke');
        const edit = { courseId, entryId, nativeText: 'danke', example };
        expect(yield* store.update({ ...edit, targetText: 'vous' })).toEqual({
          kind: 'duplicate',
          location: 'Découvertes 3 · Unité 1',
        });
        expect(
          (yield* store.update({ ...edit, targetText: 'merci' })).kind,
        ).toBe('updated');
        expect(
          yield* store.update({
            ...edit,
            courseId: otherCourseId,
            targetText: 'gracias',
          }),
        ).toEqual({ kind: 'entry-missing' });
        expect((yield* storedWord(entryId)).entry?.targetText).toBe('merci');
      }),
    );
  });
});

describe('VocabularyEntryStore deletion', () => {
  it('deletes a word with its cards, history and pronunciation', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedCourses;
        const sql = yield* Database;
        const store = yield* VocabularyEntryStore;
        const kept = yield* practisedWord('vous', 'ihr');
        const entryId = yield* practisedWord('la mémoire', 'die Erinnerung');
        expect(
          yield* store.remove({ courseId: otherCourseId, entryId }),
        ).toEqual({ unreferencedFiles: [] });
        const removed = yield* store.remove({ courseId, entryId });
        expect([...removed.unreferencedFiles].sort()).toEqual([
          exampleAudio,
          wordAudio,
        ]);
        const [left] = yield* sql<{
          readonly entries: number;
          readonly cards: number;
          readonly reviews: number;
          readonly answers: number;
          readonly examples: number;
          readonly audio: number;
        }>`
          select
            (select count(*)::int from entries) as entries,
            (select count(*)::int from cards) as cards,
            (select count(*)::int from reviews) as reviews,
            (select count(*)::int from accepted_answers) as answers,
            (select count(*)::int from entry_examples) as examples,
            (select count(*)::int from entry_audio) as audio
        `;
        // Only the other word's rows remain.
        expect(left).toEqual({
          entries: 1,
          cards: 2,
          reviews: 2,
          answers: 4,
          examples: 1,
          audio: 1,
        });
        expect((yield* storedWord(kept)).entry?.targetText).toBe('vous');
        expect(yield* store.remove({ courseId, entryId })).toEqual({
          unreferencedFiles: [],
        });
      }),
    );
  });
});
