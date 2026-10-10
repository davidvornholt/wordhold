import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { writeRelatedWords } from '../../../shared/vocabulary/related-words-store';
import {
  CourseDatabaseError,
  CourseKindMismatchError,
} from '../errors/courses-errors';
import type { SaveWordRelationsData } from '../schemas/word-relations';

export type RelationWordContext = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string | null;
  readonly targetLanguage: LanguageCode;
};

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Synonyme und Gegenteile konnten nicht gespeichert werden.',
  });

export class WordRelationStore extends Context.Service<
  WordRelationStore,
  {
    // The named words of a language course, in no particular order. Words
    // of another course, and every word of a subject, are left out.
    readonly read: (
      courseId: string,
      entryIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<RelationWordContext>, CourseDatabaseError>;
    // Resolves to the number of words written.
    readonly save: (
      input: SaveWordRelationsData,
    ) => Effect.Effect<number, CourseDatabaseError | CourseKindMismatchError>;
  }
>()('wordhold/WordRelationStore') {
  static readonly live = Layer.effect(
    WordRelationStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const read = (courseId: string, entryIds: ReadonlyArray<string>) =>
        sql<RelationWordContext>`
          select e.id as "entryId", e.target_text as "targetText",
            e.native_text as "nativeText",
            co.target_language as "targetLanguage",
            (select x.target_text from entry_examples x
              where x.entry_id = e.id
              order by x.position, x.id
              limit 1) as example
          from entries e
          join courses co on co.id = e.course_id
          where e.course_id = ${courseId} and co.kind = 'language'
            and e.id = any(${`{${entryIds.join(',')}}`}::uuid[])
        `.pipe(Effect.mapError((cause) => databaseError('read words', cause)));

      const save = ({ courseId, words }: SaveWordRelationsData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              const [course] = yield* sql<{ readonly kind: string }>`
                select kind from courses where id = ${courseId}
              `;
              if (course?.kind !== 'language') {
                return yield* new CourseKindMismatchError({
                  message:
                    'Synonyme und Gegenteile gibt es nur in Sprachkursen.',
                });
              }
              const written = yield* writeRelatedWords(
                sql,
                words.map((word) => ({ courseId, ...word })),
              );
              return written.length;
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('save related words', cause)),
            ),
          );

      return WordRelationStore.of({ read, save });
    }),
  );
}
