import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import {
  duplicateVerdict,
  type ExistingEntry,
} from '../../../shared/vocabulary/entry-identity';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { CreateVocabularyEntryData } from '../schemas/vocabulary-entry-creation';

export type CreateVocabularyEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'unit-missing' }
  | { readonly kind: 'duplicate' };

type UnitEntryRow = {
  readonly id: string;
  readonly targetText: string;
  readonly example: string | null;
};

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Vokabel konnte nicht gespeichert werden.',
  });

const groupUnitEntries = (
  rows: ReadonlyArray<UnitEntryRow>,
): ReadonlyArray<ExistingEntry> => {
  const byEntry = new Map<
    string,
    { readonly targetText: string; examples: Array<string> }
  >();
  for (const row of rows) {
    const entry = byEntry.get(row.id) ?? {
      targetText: row.targetText,
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

      // The same per-course lock the import takes, so a typed word and a
      // verified page never both pass the duplicate check for one unit. An
      // exact repeat is refused. A word that differs only in casing or
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
              const rows = yield* sql<UnitEntryRow>`
                select e.id, e.target_text as "targetText",
                  x.target_text as example
                from entries e
                left join entry_examples x on x.entry_id = e.id
                where e.unit_id = ${input.unitId}
                  and e.course_id = ${input.courseId}
              `;
              const verdict = duplicateVerdict(
                {
                  targetText: input.targetText,
                  example: input.example?.targetText ?? '',
                },
                groupUnitEntries(rows),
              );
              if (verdict === 'exact') {
                return { kind: 'duplicate' } as const;
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

      return { readTargetLanguage, create, storeAudio } as const;
    }),
  );
}
