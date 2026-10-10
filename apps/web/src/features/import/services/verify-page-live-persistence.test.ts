import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondPageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const unitThreeEntryCount = 3;

const entry = (name: string, targetText: string) => ({
  unit: { kind: 'new' as const, name },
  targetText,
  nativeText: `Deutsch ${targetText}`,
});

const seedCourse = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr')
  `;
  yield* sql`
    insert into pages (id, course_id, image_path)
    values
      (${firstPageId}, ${courseId}, 'first.png'),
      (${secondPageId}, ${courseId}, 'second.png')
  `;
});

// Grammar is the one JSON value an entry stores, and the client binds only
// scalars, so it has to reach the column as JSON text.
const importDetailedWord = Effect.gen(function* () {
  yield* seedCourse;
  const sql = yield* Database;
  yield* verifyPageLive(
    sql,
    decodeImportPayload({
      pageId: firstPageId,
      book: { kind: 'new', name: 'Découvertes 3' },
      entries: [
        {
          ...entry('Unit 3', 'prendre'),
          grammar: { _tag: 'verb', irregularForms: ['pris'] },
          example: {
            targetText: 'Je prends le bus.',
            nativeText: 'Ich nehme den Bus.',
            source: 'textbook',
          },
          synonyms: ['saisir'],
        },
      ],
    }),
    courseId,
  );
  const [stored] = yield* sql<{
    readonly grammar: unknown;
    readonly synonyms: ReadonlyArray<string> | null;
    readonly example: string | null;
  }>`
    select e.grammar, e.synonyms, x.target_text as example
    from entries e
    left join entry_examples x on x.entry_id = e.id
  `;
  const cards = yield* sql<{ readonly direction: string }>`
    select direction from cards order by direction
  `;
  return { stored, directions: cards.map((card) => card.direction) };
});

describe('verifyPageLive persistence', () => {
  it('routes one page into two units and reuses a matching name', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          const sql = yield* Database;
          yield* verifyPageLive(
            sql,
            decodeImportPayload({
              pageId: firstPageId,
              book: { kind: 'new', name: 'Découvertes 3' },
              entries: [
                entry('Unit 3', 'mémoire'),
                entry('Unit 4', 'livre'),
                entry('Unit 3', 'souvenir'),
              ],
            }),
            courseId,
          );
          yield* verifyPageLive(
            sql,
            decodeImportPayload({
              pageId: secondPageId,
              book: { kind: 'new', name: 'Découvertes 3' },
              entries: [entry('Unit 3', 'répéter')],
            }),
            courseId,
          );
          const units = yield* sql<{
            readonly id: string;
            readonly name: string;
          }>`select id, name from units order by position`;
          expect(units.map((unit) => unit.name)).toEqual(['Unit 3', 'Unit 4']);
          const persisted = yield* sql<{
            readonly pageId: string;
            readonly unitId: string | null;
          }>`
            select page_id as "pageId", unit_id as "unitId"
            from entries
            order by target_text
          `;
          expect(
            new Set(
              persisted
                .filter((row) => row.pageId === firstPageId)
                .map((row) => row.unitId),
            ).size,
          ).toBe(2);
          expect(persisted.every((row) => row.pageId !== null)).toBe(true);
          expect(persisted.every((row) => row.unitId !== null)).toBe(true);
          const unitThree = units.find((unit) => unit.name === 'Unit 3');
          expect(
            persisted.filter((row) => row.unitId === unitThree?.id),
          ).toHaveLength(unitThreeEntryCount);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('stores the grammar, example and synonyms read from the page', async () => {
    const { stored, directions } = await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        importDetailedWord.pipe(
          Effect.provide(testDatabaseLayer(database.url)),
        ),
      ),
    );
    expect(stored).toEqual({
      grammar: { _tag: 'verb', irregularForms: ['pris'] },
      synonyms: ['saisir'],
      example: 'Je prends le bus.',
    });
    expect(directions).toEqual(['to_target', 'to_native', 'to_synonym']);
  });

  it('allocates sequential positions across concurrent imports', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          const sql = yield* Database;
          yield* Effect.all(
            [
              verifyPageLive(
                sql,
                decodeImportPayload({
                  pageId: firstPageId,
                  book: { kind: 'new', name: 'Découvertes 3' },
                  entries: [entry('Unit 3', 'mémoire')],
                }),
                courseId,
              ),
              verifyPageLive(
                sql,
                decodeImportPayload({
                  pageId: secondPageId,
                  book: { kind: 'new', name: 'Découvertes 3' },
                  entries: [entry('Unit 4', 'livre')],
                }),
                courseId,
              ),
            ],
            { concurrency: 'unbounded' },
          );
          const positions = yield* sql<{ readonly position: number }>`
            select position from units order by position
          `;
          expect(positions.map((unit) => unit.position)).toEqual([0, 1]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
