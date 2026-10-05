import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { findDuplicate } from '../../../shared/vocabulary/entry-identity';
import { CourseDatabaseError } from '../errors/courses-errors';
import type {
  CreateTextEntryData,
  UpdateTextEntryData,
} from '../schemas/text-entry-changes';

export type CreateTextEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'course-missing' }
  | { readonly kind: 'not-texts' }
  | { readonly kind: 'duplicate' };

export type UpdateTextEntryResult =
  | { readonly kind: 'updated' }
  | { readonly kind: 'text-missing' }
  | { readonly kind: 'duplicate' };

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Text konnte nicht gespeichert werden.',
  });

// Every entry needs a book, so a collection keeps its texts in the one book
// it is created with (see createSubject). A recited text is compared word
// for word with the entry itself, so unlike a word or a term it has no
// accepted answers: a long text would not fit their index anyway.
const insertText = (sql: Database, input: CreateTextEntryData) =>
  Effect.gen(function* () {
    const [entry] = yield* sql<{ readonly id: string }>`
      insert into entries
        (course_id, book_id, unit_id, target_text, native_text)
      select ${input.courseId}, b.id, null, ${input.title}, ${input.text}
      from books b
      where b.course_id = ${input.courseId}
      order by b.position asc
      limit 1
      returning id
    `;
    if (entry === undefined) {
      return yield* databaseError(
        'create text',
        new Error('The collection has no book to hold its texts.'),
      );
    }
    yield* sql`
      insert into cards (entry_id, direction)
      values (${entry.id}, 'to_native')
    `;
    return entry.id;
  });

// A title names one text, so an exact repeat in the collection is refused.
// A corrected text is not compared with itself.
const repeatsTitle = (
  sql: Database,
  courseId: string,
  title: string,
  correctedEntryId: string | null,
) =>
  sql<{ readonly targetText: string }>`
    select target_text as "targetText" from entries
    where course_id = ${courseId}
      and (${correctedEntryId}::uuid is null or id <> ${correctedEntryId}::uuid)
  `.pipe(
    Effect.map(
      (rows) =>
        findDuplicate(
          { targetText: title, example: '' },
          rows.map((row) => ({ targetText: row.targetText, examples: [] })),
        ).verdict === 'exact',
    ),
  );

const lockCourse = (sql: Database, courseId: string) =>
  sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;

export class TextEntryStore extends Context.Tag('wordhold/TextEntryStore')<
  TextEntryStore,
  {
    readonly create: (
      input: CreateTextEntryData,
    ) => Effect.Effect<CreateTextEntryResult, CourseDatabaseError>;
    readonly update: (
      input: UpdateTextEntryData,
    ) => Effect.Effect<UpdateTextEntryResult, CourseDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    TextEntryStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      // The same per-course lock the other entries take. A text is asked
      // only from title to text, so it gets that one card.
      const create = (input: CreateTextEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* lockCourse(sql, input.courseId);
              const [course] = yield* sql<{ readonly kind: string }>`
                select kind from courses where id = ${input.courseId}
              `;
              if (course === undefined) {
                return { kind: 'course-missing' } as const;
              }
              if (course.kind !== 'texts') {
                return { kind: 'not-texts' } as const;
              }
              if (yield* repeatsTitle(sql, input.courseId, input.title, null)) {
                return { kind: 'duplicate' } as const;
              }
              const entryId = yield* insertText(sql, input);
              return { kind: 'created', entryId } as const;
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('create text', cause)),
            ),
          );

      const update = (input: UpdateTextEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* lockCourse(sql, input.courseId);
              const stored = yield* sql<{ readonly id: string }>`
                select e.id from entries e
                join courses co on co.id = e.course_id
                where e.id = ${input.entryId} and e.course_id = ${input.courseId}
                  and co.kind = 'texts'
              `;
              if (stored.length === 0) {
                return { kind: 'text-missing' } as const;
              }
              if (
                yield* repeatsTitle(
                  sql,
                  input.courseId,
                  input.title,
                  input.entryId,
                )
              ) {
                return { kind: 'duplicate' } as const;
              }
              yield* sql`
                update entries
                set target_text = ${input.title}, native_text = ${input.text}
                where id = ${input.entryId}
              `;
              return { kind: 'updated' } as const;
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('update text', cause)),
            ),
          );

      return { create, update } as const;
    }),
  );
}
