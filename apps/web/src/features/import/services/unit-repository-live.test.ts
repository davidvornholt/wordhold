import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { decodeImportPayload } from '../schemas/import-payload';
import { unitRepositoryLive } from './unit-repository-live';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondPageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const importInto = (pageId: string, bookName: string, targetText: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* verifyPageLive(
      sql,
      decodeImportPayload({
        pageId,
        book: { kind: 'new', name: bookName },
        entries: [
          {
            unit: { kind: 'new', name: 'U1 Acércate' },
            targetText,
            nativeText: `Deutsch ${targetText}`,
          },
        ],
      }),
      courseId,
    );
  });

describe('unitRepositoryLive', () => {
  it('lists books with their latest import and names where each word is', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'Spanisch', 'es')
          `;
          yield* sql`
            insert into pages (id, course_id, image_path)
            values
              (${firstPageId}, ${courseId}, 'first.png'),
              (${secondPageId}, ${courseId}, 'second.png')
          `;
          yield* importInto(firstPageId, 'Encuentros hoy 3', 'la playa');
          yield* importInto(secondPageId, 'Encuentros hoy 2', 'el mar');
          yield* sql`
            insert into books (course_id, name, position)
            values (${courseId}, 'Encuentros hoy 4', 2)
          `;
          const repository = unitRepositoryLive(sql);

          const books = yield* repository.listBooks(courseId);
          expect(books.map((book) => book.name)).toEqual([
            'Encuentros hoy 3',
            'Encuentros hoy 2',
            'Encuentros hoy 4',
          ]);
          expect(books.map((book) => book.lastImportedAt === null)).toEqual([
            false,
            false,
            true,
          ]);

          const bookNames = new Map(books.map((book) => [book.id, book.name]));
          const units = yield* repository.listUnits(courseId);
          expect(
            units.map((unit) => [bookNames.get(unit.bookId), unit.name]),
          ).toEqual([
            ['Encuentros hoy 3', 'U1 Acércate'],
            ['Encuentros hoy 2', 'U1 Acércate'],
          ]);

          const entries = yield* repository.listUnitEntries(courseId);
          expect(
            entries.map((entry) => [entry.targetText, entry.location]),
          ).toEqual([
            ['la playa', 'Encuentros hoy 3 · U1 Acércate'],
            ['el mar', 'Encuentros hoy 2 · U1 Acércate'],
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
