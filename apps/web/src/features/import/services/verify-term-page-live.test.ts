import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import { decodeTermPayload } from '../schemas/term-payload';
import { verifyTermPageLive } from './verify-term-page-live';

const subjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bookId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const pageIds = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
] as const;

const seedSubject = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses
      (id, name, kind, target_language, native_language, directions)
    values
      (${subjectId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${bookId}, ${subjectId}, 'Allgemein', 0)
  `;
  yield* sql`
    insert into pages (id, course_id, image_path)
    values
      (${pageIds[0]}, ${subjectId}, 'first.png'),
      (${pageIds[1]}, ${subjectId}, 'second.png')
  `;
});

const saveTerms = (
  pageId: string,
  terms: ReadonlyArray<{ readonly term: string; readonly definition: string }>,
) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* Effect.result(
      verifyTermPageLive(sql, decodeTermPayload({ pageId, terms }), subjectId),
    );
  });

const pageStatus = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const rows = yield* sql<{ readonly status: string }>`
      select status from pages where id = ${pageId}
    `;
    return rows[0]?.status;
  });

const storedTerms = Effect.gen(function* () {
  const sql = yield* Database;
  return yield* sql<{ readonly term: string; readonly pageId: string }>`
    select target_text as term, page_id as "pageId" from entries
    order by created_at, id
  `;
});

const runWithSubject = <A, E>(
  test: Effect.Effect<A, E, Database>,
): Promise<A> =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* seedSubject;
        return yield* test;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

describe('verifyTermPageLive', () => {
  it('saves every term as a card from its page and closes the page', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        const saved = yield* saveTerms(pageIds[0], [
          { term: ' Alkan ', definition: 'Organische Verbindung' },
          { term: 'Methan', definition: 'CH₄' },
        ]);
        expect(saved._tag).toBe('Success');
        expect(saved._tag === 'Success' ? saved.success : []).toHaveLength(2);
        expect(yield* storedTerms).toEqual([
          { term: 'Alkan', pageId: pageIds[0] },
          { term: 'Methan', pageId: pageIds[0] },
        ]);
        const sql = yield* Database;
        const cards = yield* sql<{
          readonly direction: string;
          readonly answer: string;
          readonly bookId: string;
        }>`
          select cards.direction, accepted_answers.text as answer,
            entries.book_id as "bookId"
          from entries
          join cards on cards.entry_id = entries.id
          join accepted_answers on accepted_answers.entry_id = entries.id
          where entries.target_text = 'Methan'
        `;
        expect(cards).toEqual([
          { direction: 'to_native', answer: 'CH₄', bookId },
        ]);
        expect(yield* pageStatus(pageIds[0])).toBe('verified');
      }),
    );
  });

  it('refuses a term the subject already has and leaves the page open', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        yield* saveTerms(pageIds[0], [
          { term: 'Alkan', definition: 'Organische Verbindung' },
        ]);
        const repeated = yield* saveTerms(pageIds[1], [
          { term: 'Methan', definition: 'CH₄' },
          { term: 'Alkan:', definition: 'Kohlenwasserstoff' },
        ]);
        expect(repeated._tag === 'Failure' ? repeated.failure : null).toEqual(
          expect.any(DuplicateEntryError),
        );
        expect(
          repeated._tag === 'Failure' &&
            repeated.failure._tag === 'DuplicateEntryError'
            ? repeated.failure.duplicates
            : [],
        ).toEqual(['Alkan:']);
        expect(yield* pageStatus(pageIds[1])).toBe('awaiting_verification');
        expect((yield* storedTerms).map((row) => row.term)).toEqual(['Alkan']);
      }),
    );
  });

  it('refuses a term written twice on one page', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        const repeated = yield* saveTerms(pageIds[0], [
          { term: 'Ethan', definition: 'C₂H₆' },
          { term: 'Ethan', definition: 'C₂H₆' },
        ]);
        expect(repeated._tag).toBe('Failure');
        expect(yield* storedTerms).toEqual([]);
      }),
    );
  });

  it('saves the same term in another casing', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        yield* saveTerms(pageIds[0], [
          { term: 'Alkan', definition: 'Organische Verbindung' },
        ]);
        const variant = yield* saveTerms(pageIds[1], [
          { term: 'ALKAN', definition: 'Organische Verbindung' },
        ]);
        expect(variant._tag).toBe('Success');
      }),
    );
  });

  it('closes a page without terms', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        const closed = yield* saveTerms(pageIds[0], []);
        expect(closed._tag).toBe('Success');
        expect(yield* pageStatus(pageIds[0])).toBe('verified');
      }),
    );
  });

  it('lets only one of two pages saved at once add the same new term', async () => {
    await runWithSubject(
      Effect.gen(function* () {
        const results = yield* Effect.all(
          pageIds.map((pageId) =>
            saveTerms(pageId, [{ term: 'Propan', definition: 'C₃H₈' }]),
          ),
          { concurrency: 'unbounded' },
        );
        const failures = results.flatMap((result) =>
          result._tag === 'Failure' ? [result.failure] : [],
        );
        expect(failures).toEqual([expect.any(DuplicateEntryError)]);
        expect((yield* storedTerms).map((row) => row.term)).toEqual(['Propan']);
        const statuses = yield* Effect.all(pageIds.map(pageStatus));
        expect([...statuses].sort()).toEqual([
          'awaiting_verification',
          'verified',
        ]);
      }),
    );
  });
});
