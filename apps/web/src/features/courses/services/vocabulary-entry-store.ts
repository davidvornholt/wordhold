import { Database } from '@wordhold/db/client';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { CourseDatabaseError } from '../errors/courses-errors';
import type {
  DeleteEntryData,
  UpdateVocabularyEntryData,
} from '../schemas/entry-changes';
import type { CreateVocabularyEntryData } from '../schemas/vocabulary-entry-creation';
import { findCourseDuplicate } from './vocabulary-entry-duplicates';
import {
  makeVocabularyEntryMutations,
  type RemovedEntry,
  type UpdateVocabularyEntryResult,
} from './vocabulary-entry-mutations';

export type WordPlace = {
  readonly bookId: string;
  readonly unitId: string | null;
};

export type LanguageCourse = {
  readonly kind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

export type PlaceContext = LanguageCourse & {
  readonly unitName: string | null;
};

export type CreateVocabularyEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'place-missing' }
  | { readonly kind: 'duplicate'; readonly location: string };

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Vokabel konnte nicht gespeichert werden.',
  });

export class VocabularyEntryStore extends Context.Service<
  VocabularyEntryStore,
  {
    readonly readCourse: (
      courseId: string,
    ) => Effect.Effect<LanguageCourse | undefined, CourseDatabaseError>;
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
    readonly update: (
      input: UpdateVocabularyEntryData,
    ) => Effect.Effect<UpdateVocabularyEntryResult, CourseDatabaseError>;
    readonly remove: (
      input: DeleteEntryData,
    ) => Effect.Effect<RemovedEntry, CourseDatabaseError>;
  }
>()('wordhold/VocabularyEntryStore') {
  static readonly live = Layer.effect(
    VocabularyEntryStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const readCourse = (courseId: string) =>
        sql<LanguageCourse>`
          select kind, target_language as "targetLanguage"
          from courses where id = ${courseId} limit 1
        `.pipe(
          Effect.map((rows) => rows[0]),
          Effect.mapError((cause) =>
            databaseError('read course language', cause),
          ),
        );

      // A book without the unit yields no row when a unit was asked for,
      // because the unit's name is then required to match.
      const selectPlace = (courseId: string, { bookId, unitId }: WordPlace) =>
        sql<PlaceContext>`
          select co.kind, co.target_language as "targetLanguage",
            u.name as "unitName"
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
              const duplicate = yield* findCourseDuplicate(
                sql,
                input.courseId,
                {
                  targetText: input.targetText,
                  example: input.example?.targetText ?? '',
                },
                null,
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
                  synonyms: null,
                  antonyms: null,
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

      return {
        readCourse,
        readPlace,
        create,
        storeAudio,
        ...makeVocabularyEntryMutations(sql),
      } as const;
    }),
  );
}
