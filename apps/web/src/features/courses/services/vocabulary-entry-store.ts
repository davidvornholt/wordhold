import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { unitLocation } from '../../../shared/vocabulary/book-name';
import {
  type ExistingEntry,
  findDuplicate,
} from '../../../shared/vocabulary/entry-identity';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { CreateVocabularyEntryData } from '../schemas/vocabulary-entry-creation';

export type UnitContext = {
  readonly targetLanguage: LanguageCode;
  readonly unitName: string;
};

export type CreateVocabularyEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'unit-missing' }
  | { readonly kind: 'duplicate'; readonly location: string };

type CourseEntryRow = {
  readonly id: string;
  readonly targetText: string;
  readonly example: string | null;
  readonly bookName: string;
  readonly unitName: string;
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
      location: unitLocation(row.bookName, row.unitName),
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
    // Undefined when the unit does not belong to the course.
    readonly readUnit: (
      courseId: string,
      unitId: string,
    ) => Effect.Effect<UnitContext | undefined, CourseDatabaseError>;
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

      const readUnit = (courseId: string, unitId: string) =>
        sql<UnitContext>`
          select co.target_language as "targetLanguage", u.name as "unitName"
          from units u
          join courses co on co.id = u.course_id
          where u.id = ${unitId} and u.course_id = ${courseId}
          limit 1
        `.pipe(
          Effect.map((rows) => rows[0]),
          Effect.mapError((cause) => databaseError('read unit', cause)),
        );

      // The same per-course lock the import takes, so a typed word and a
      // verified page never both pass the duplicate check. The check spans the
      // whole course, every book included: an exact repeat is refused. A word that differs only in casing or
      // example sentence is stored: the learner typed it on purpose, which
      // is the confirmation the verify screen has to ask for separately.
      const create = (input: CreateVocabularyEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
              const unit = yield* sql<{ readonly id: string }>`
                select id from units
                where id = ${input.unitId} and course_id = ${input.courseId}
                limit 1
              `;
              if (unit.length === 0) {
                return { kind: 'unit-missing' } as const;
              }
              const rows = yield* sql<CourseEntryRow>`
                select e.id, e.target_text as "targetText",
                  x.target_text as example,
                  b.name as "bookName", u.name as "unitName"
                from entries e
                join units u on u.id = e.unit_id
                join books b on b.id = u.book_id
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

      return { readTargetLanguage, readUnit, create, storeAudio } as const;
    }),
  );
}
