import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import {
  type ExistingEntry,
  findDuplicate,
} from '../../../shared/vocabulary/entry-identity';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { CreateVocabularyEntryData } from '../schemas/vocabulary-entry-creation';

export type WordPlace = {
  readonly bookId: string;
  readonly unitId: string | null;
};

export type PlaceContext = {
  readonly targetLanguage: LanguageCode;
  readonly unitName: string | null;
};

export type CreateVocabularyEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'place-missing' }
  | { readonly kind: 'duplicate'; readonly location: string };

type CourseEntryRow = {
  readonly id: string;
  readonly targetText: string;
  readonly example: string | null;
  readonly bookName: string;
  readonly unitName: string | null;
};

type LocatedEntry = ExistingEntry & { readonly location: string };

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Vokabel konnte nicht gespeichert werden.',
  });

const groupCourseEntries = (
  rows: ReadonlyArray<CourseEntryRow>,
): ReadonlyArray<LocatedEntry> => {
  const byEntry = new Map<
    string,
    {
      readonly targetText: string;
      readonly location: string;
      examples: Array<string>;
    }
  >();
  for (const row of rows) {
    const entry = byEntry.get(row.id) ?? {
      targetText: row.targetText,
      location: wordLocation(row.bookName, row.unitName),
      examples: [],
    };
    if (row.example !== null) {
      entry.examples.push(row.example);
    }
    byEntry.set(row.id, entry);
  }
  return [...byEntry.values()];
};

export class VocabularyEntryStore extends Context.Tag(
  'wordhold/VocabularyEntryStore',
)<
  VocabularyEntryStore,
  {
    readonly readTargetLanguage: (
      courseId: string,
    ) => Effect.Effect<LanguageCode | undefined, CourseDatabaseError>;
    // Undefined when the book does not belong to the course or the unit
    // not to the book.
    readonly readPlace: (
      courseId: string,
      place: WordPlace,
    ) => Effect.Effect<PlaceContext | undefined, CourseDatabaseError>;
    readonly create: (
      input: CreateVocabularyEntryData,
    ) => Effect.Effect<CreateVocabularyEntryResult, CourseDatabaseError>;
    readonly storeAudio: (
      entryId: string,
      audioProfile: string,
      audioPath: string,
    ) => Effect.Effect<void, CourseDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    VocabularyEntryStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const readTargetLanguage = (courseId: string) =>
        sql<{ readonly targetLanguage: LanguageCode }>`
          select target_language as "targetLanguage"
          from courses where id = ${courseId} limit 1
        `.pipe(
          Effect.map((rows) => rows[0]?.targetLanguage),
          Effect.mapError((cause) =>
            databaseError('read course language', cause),
          ),
        );

      // A book without the unit yields no row when a unit was asked for,
      // because the unit's name is then required to match.
      const selectPlace = (courseId: string, { bookId, unitId }: WordPlace) =>
        sql<PlaceContext>`
          select co.target_language as "targetLanguage", u.name as "unitName"
          from books b
          join courses co on co.id = b.course_id
          left join units u on u.id = ${unitId}::uuid and u.book_id = b.id
          where b.id = ${bookId} and b.course_id = ${courseId}
            and (${unitId}::uuid is null or u.id is not null)
          limit 1
        `.pipe(Effect.map((rows) => rows[0]));

      const readPlace = (courseId: string, place: WordPlace) =>
        selectPlace(courseId, place).pipe(
          Effect.mapError((cause) => databaseError('read place', cause)),
        );

      // The same per-course lock the import takes, so a typed word and a
      // verified page never both pass the duplicate check. The check spans the
      // whole course, every book included: an exact repeat is refused. A word
      // that differs only in casing or example sentence is stored: the
      // learner typed it on purpose, which is the confirmation the verify
      // screen has to ask for separately.
      const create = (input: CreateVocabularyEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
              const place = yield* selectPlace(input.courseId, input);
              if (place === undefined) {
                return { kind: 'place-missing' } as const;
              }
              const rows = yield* sql<CourseEntryRow>`
                select e.id, e.target_text as "targetText",
                  x.target_text as example,
                  b.name as "bookName", u.name as "unitName"
                from entries e
                join books b on b.id = e.book_id
                left join units u on u.id = e.unit_id
                left join entry_examples x on x.entry_id = e.id
                where e.course_id = ${input.courseId}
              `;
              const duplicate = findDuplicate(
                {
                  targetText: input.targetText,
                  example: input.example?.targetText ?? '',
                },
                groupCourseEntries(rows),
              );
              if (duplicate.verdict === 'exact') {
                return {
                  kind: 'duplicate',
                  location: duplicate.entry.location,
                } as const;
              }
              const inserted = yield* insertVocabularyEntries(sql, [
                {
                  courseId: input.courseId,
                  bookId: input.bookId,
                  unitId: input.unitId,
                  pageId: null,
                  targetText: input.targetText,
                  nativeText: input.nativeText,
                  grammar: null,
                  example: input.example,
                },
              ]);
              const [entry] = inserted;
              return entry === undefined
                ? yield* databaseError(
                    'create entry',
                    new Error('The entry was not inserted.'),
                  )
                : ({ kind: 'created', entryId: entry.id } as const);
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('create entry', cause)),
            ),
          );

      const storeAudio = (
        entryId: string,
        audioProfile: string,
        audioPath: string,
      ) =>
        sql`
          insert into entry_audio (entry_id, voice, path)
          values (${entryId}, ${audioProfile}, ${audioPath})
          on conflict (entry_id, voice) do update set path = excluded.path
        `.pipe(
          Effect.asVoid,
          Effect.mapError((cause) => databaseError('store entry audio', cause)),
        );

      return { readTargetLanguage, readPlace, create, storeAudio } as const;
    }),
  );
}
