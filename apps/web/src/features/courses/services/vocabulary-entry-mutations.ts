import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import type { NewExampleData } from '../../../shared/vocabulary/entry-fields';
import { writeRelatedWords } from '../../../shared/vocabulary/related-words-store';
import { CourseDatabaseError } from '../errors/courses-errors';
import type {
  DeleteEntriesData,
  UpdateVocabularyEntryData,
} from '../schemas/entry-changes';
import { expireEntryCards, replaceTextbookAnswers } from './entry-answers';
import { findCourseDuplicate } from './vocabulary-entry-duplicates';

export type UpdateVocabularyEntryResult =
  | {
      readonly kind: 'updated';
      // The stored pronunciation was of the old word, so it is gone.
      readonly wordChanged: boolean;
      // Audio files nothing refers to anymore.
      readonly unreferencedFiles: ReadonlyArray<string>;
    }
  | { readonly kind: 'entry-missing' }
  | { readonly kind: 'stale' }
  | { readonly kind: 'duplicate'; readonly location: string };

export type RemovedEntries = {
  // Audio files nothing refers to anymore.
  readonly unreferencedFiles: ReadonlyArray<string>;
};

type StoredWord = {
  readonly revision: number;
  readonly targetText: string;
  readonly nativeText: string;
  readonly exampleId: string | null;
  readonly exampleTargetText: string | null;
  readonly exampleNativeText: string | null;
  readonly exampleSource: NewExampleData['source'] | null;
  readonly exampleAudioPath: string | null;
};

type PathRow = { readonly path: string };

const updateError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Vokabel konnte nicht gespeichert werden.',
  });

const removeError = (cause: unknown) =>
  new CourseDatabaseError({
    operation: 'delete entries',
    cause,
    message: 'Die Einträge konnten nicht gelöscht werden.',
  });

const pathsOf = (path: string | null): ReadonlyArray<string> =>
  path === null ? [] : [path];

type ExampleCorrection =
  | { readonly kind: 'none' }
  | { readonly kind: 'add'; readonly example: NewExampleData }
  | {
      readonly kind: 'remove';
      readonly exampleId: string;
      readonly audioPath: string | null;
    }
  | {
      readonly kind: 'replace';
      readonly exampleId: string;
      readonly audioPath: string | null;
      readonly example: NewExampleData;
    }
  | {
      readonly kind: 'correct';
      readonly exampleId: string;
      readonly nativeText: string | null;
      readonly source: NewExampleData['source'];
    };

// The learner sees and corrects the first example. A new sentence drops
// the old sentence's audio, which is prepared again when the word's details
// are next shown; the same sentence keeps it, with the translation and the
// source the edit gives.
const exampleCorrection = (
  stored: StoredWord,
  example: NewExampleData | undefined,
): ExampleCorrection => {
  if (stored.exampleId === null) {
    return example === undefined ? { kind: 'none' } : { kind: 'add', example };
  }
  if (example === undefined) {
    return {
      kind: 'remove',
      exampleId: stored.exampleId,
      audioPath: stored.exampleAudioPath,
    };
  }
  if (example.targetText !== stored.exampleTargetText) {
    return {
      kind: 'replace',
      exampleId: stored.exampleId,
      audioPath: stored.exampleAudioPath,
      example,
    };
  }
  const nativeText = example.nativeText ?? null;
  return nativeText === stored.exampleNativeText &&
    example.source === stored.exampleSource
    ? { kind: 'none' }
    : {
        kind: 'correct',
        exampleId: stored.exampleId,
        nativeText,
        source: example.source,
      };
};

// An example edit alone adds a revision; any other change already did, so
// the revision the editor loaded is replaced only once.
const markExampleEdited = (
  sql: Database,
  entryId: string,
  stored: StoredWord,
  correction: ExampleCorrection,
) =>
  correction.kind === 'none'
    ? Effect.void
    : sql`
        update entries set revision = revision + 1
        where id = ${entryId} and revision = ${stored.revision}
      `;

export const makeVocabularyEntryMutations = (sql: Database) => {
  // Resolves to the audio files the correction leaves unreferenced.
  const correctExample = (entryId: string, correction: ExampleCorrection) => {
    switch (correction.kind) {
      case 'none':
        return Effect.succeed<ReadonlyArray<string>>([]);
      case 'add':
        return sql`
          insert into entry_examples
            (entry_id, target_text, native_text, source, position)
          values (${entryId}, ${correction.example.targetText},
            ${correction.example.nativeText ?? null},
            ${correction.example.source}, 0)
        `.pipe(Effect.as([]));
      case 'remove':
        return sql`
          delete from entry_examples where id = ${correction.exampleId}
        `.pipe(Effect.as(pathsOf(correction.audioPath)));
      case 'replace':
        return sql`
          update entry_examples
          set target_text = ${correction.example.targetText},
            native_text = ${correction.example.nativeText ?? null},
            source = ${correction.example.source},
            audio_profile = null, audio_path = null
          where id = ${correction.exampleId}
        `.pipe(Effect.as(pathsOf(correction.audioPath)));
      case 'correct':
        return sql`
          update entry_examples
          set native_text = ${correction.nativeText},
            source = ${correction.source}
          where id = ${correction.exampleId}
        `.pipe(Effect.as([]));
      default:
        return correction satisfies never;
    }
  };

  // New texts replace the textbook answers, and a new word drops the old
  // one's pronunciation. Resolves to the audio files left unreferenced.
  const correctTexts = (input: UpdateVocabularyEntryData, stored: StoredWord) =>
    Effect.gen(function* () {
      const wordChanged = stored.targetText !== input.targetText;
      if (!wordChanged && stored.nativeText === input.nativeText) {
        return [];
      }
      yield* sql`
        update entries
        set target_text = ${input.targetText}, native_text = ${input.nativeText},
          revision = revision + 1
        where id = ${input.entryId}
      `;
      yield* replaceTextbookAnswers(sql, input.entryId, [
        { direction: 'to_target', text: input.targetText },
        { direction: 'to_native', text: input.nativeText },
      ]);
      yield* expireEntryCards(sql, input.entryId);
      if (!wordChanged) {
        return [];
      }
      // The pitfalls belong to the old spelling; the next pass finds new ones.
      yield* sql`
        update entries set spelling_pitfalls = null where id = ${input.entryId}
      `;
      const audio = yield* sql<PathRow>`
        delete from entry_audio where entry_id = ${input.entryId}
        returning path
      `;
      return audio.map((row) => row.path);
    });

  // The per-course lock the typed and imported words take, so a corrected
  // word and a new one never both pass the duplicate check. Only an exact
  // repeat of another word is refused, as for a typed word. The cards keep
  // their schedule: a correction does not make the word new to the learner.
  // The entry's row is locked before its example is read, so an example
  // generated meanwhile is either stored first, which raises the revision and
  // refuses an editor that did not show it, or sees the new word and is
  // dropped (see storeGenerated).
  const update = (input: UpdateVocabularyEntryData) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
          // Its own statement, so the read below sees what a waited-for
          // transaction committed.
          yield* sql`select from entries where id = ${input.entryId} for no key update`;
          const [stored] = yield* sql<StoredWord>`
            select e.revision, e.target_text as "targetText",
              e.native_text as "nativeText",
              x.id as "exampleId", x.target_text as "exampleTargetText",
              x.native_text as "exampleNativeText",
              x.source as "exampleSource",
              x.audio_path as "exampleAudioPath"
            from entries e
            left join lateral (
              select id, target_text, native_text, source, audio_path
              from entry_examples
              where entry_id = e.id
              order by position, id
              limit 1
            ) x on true
            where e.id = ${input.entryId} and e.course_id = ${input.courseId}
          `;
          if (stored === undefined) {
            return { kind: 'entry-missing' } as const;
          }
          // An older editor would write its wording over a newer one.
          if (stored.revision !== input.revision) {
            return { kind: 'stale' } as const;
          }
          const duplicate = yield* findCourseDuplicate(
            sql,
            input.courseId,
            {
              targetText: input.targetText,
              example: input.example?.targetText ?? '',
            },
            input.entryId,
          );
          if (duplicate.verdict === 'exact') {
            return {
              kind: 'duplicate',
              location: duplicate.entry.location,
            } as const;
          }
          const pronunciation = yield* correctTexts(input, stored);
          const correction = exampleCorrection(stored, input.example);
          const exampleAudio = yield* correctExample(input.entryId, correction);
          yield* writeRelatedWords(sql, [input]);
          yield* markExampleEdited(sql, input.entryId, stored, correction);
          return {
            kind: 'updated',
            wordChanged: stored.targetText !== input.targetText,
            unreferencedFiles: [...pronunciation, ...exampleAudio],
          } as const;
        }),
      )
      .pipe(
        Effect.catchTag('SqlError', (cause) =>
          Effect.fail(updateError('update entry', cause)),
        ),
      );

  // Words, terms and texts alike. The cards, their reviews and every other
  // row of an entry go with it; the audio files are read first, since nothing
  // refers to them afterwards. An entry that is already gone counts as
  // deleted, and one of another course stays.
  const remove = ({ courseId, entryIds }: DeleteEntriesData) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const ids = `{${entryIds.join(',')}}`;
          const files = yield* sql<PathRow>`
            select a.path from entry_audio a
            join entries e on e.id = a.entry_id
            where e.id = any(${ids}::uuid[]) and e.course_id = ${courseId}
            union all
            select x.audio_path as path from entry_examples x
            join entries e on e.id = x.entry_id
            where e.id = any(${ids}::uuid[]) and e.course_id = ${courseId}
              and x.audio_path is not null
          `;
          yield* sql`
            delete from entries
            where id = any(${ids}::uuid[]) and course_id = ${courseId}
          `;
          return {
            unreferencedFiles: files.map((row) => row.path),
          } satisfies RemovedEntries;
        }),
      )
      .pipe(Effect.mapError(removeError));

  return { update, remove } as const;
};
