import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import {
  dueEntryId,
  fixtureCourseId,
  seedIntroducedCardFixture,
} from '../testing/introduced-card-fixture';
import { writeRelatedWords } from './related-words-store';

const otherCourseId = '12121212-1212-4212-8212-121212121212';

const runTest = <A, E>(effect: Effect.Effect<A, E, Database>) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      effect.pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

const relationState = Effect.gen(function* () {
  const sql = yield* Database;
  const cards = yield* sql<{ readonly direction: string }>`
    select direction from cards
    where entry_id = ${dueEntryId}
      and direction in ('to_synonym', 'to_antonym')
    order by direction
  `;
  const answers = yield* sql<{
    readonly direction: string;
    readonly text: string;
    readonly source: string;
  }>`
    select direction, text, source from accepted_answers
    where entry_id = ${dueEntryId}
      and direction in ('to_synonym', 'to_antonym')
    order by direction, text
  `;
  return {
    cards: cards.map((card) => card.direction),
    answers: answers.map(({ direction, text, source }) => ({
      direction,
      text,
      source,
    })),
  };
});

describe('writeRelatedWords', () => {
  it('keeps one card per non-empty list, answered by the listed words', async () => {
    await runTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const write = (
          synonyms: ReadonlyArray<string> | null,
          antonyms: ReadonlyArray<string> | null,
        ) =>
          writeRelatedWords(sql, [
            {
              courseId: fixtureCourseId,
              entryId: dueEntryId,
              synonyms,
              antonyms,
            },
          ]);

        yield* write(['souvenir', 'réminiscence'], []);
        expect(yield* relationState).toEqual({
          cards: ['to_synonym'],
          answers: [
            {
              direction: 'to_synonym',
              text: 'réminiscence',
              source: 'textbook',
            },
            { direction: 'to_synonym', text: 'souvenir', source: 'textbook' },
          ],
        });

        // A changed list keeps its card and the judge's alternatives, and
        // replaces only the listed words.
        yield* sql`
          insert into accepted_answers
            (entry_id, direction, text, normalized, source)
          values (${dueEntryId}, 'to_synonym', 'recollection', 'recollection', 'judge')
        `;
        const [before] = yield* sql<{ readonly id: string }>`
          select id from cards
          where entry_id = ${dueEntryId} and direction = 'to_synonym'
        `;
        yield* write(['souvenir'], ['oubli']);
        expect(yield* relationState).toEqual({
          cards: ['to_synonym', 'to_antonym'],
          answers: [
            { direction: 'to_synonym', text: 'recollection', source: 'judge' },
            { direction: 'to_synonym', text: 'souvenir', source: 'textbook' },
            { direction: 'to_antonym', text: 'oubli', source: 'textbook' },
          ],
        });
        const [after] = yield* sql<{ readonly id: string }>`
          select id from cards
          where entry_id = ${dueEntryId} and direction = 'to_synonym'
        `;
        expect(after?.id).toBe(before?.id);

        // An emptied or unsettled list takes its card and every answer.
        yield* write([], null);
        expect(yield* relationState).toEqual({ cards: [], answers: [] });
      }),
    );
  });

  it('leaves a word of another course alone', async () => {
    await runTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const written = yield* writeRelatedWords(sql, [
          {
            courseId: otherCourseId,
            entryId: dueEntryId,
            synonyms: ['souvenir'],
            antonyms: ['oubli'],
          },
        ]);
        expect(written).toEqual([]);
        expect(yield* relationState).toEqual({ cards: [], answers: [] });
      }),
    );
  });
});
