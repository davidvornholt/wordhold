import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import {
  selectedEntries,
  type VocabularySelectionData,
} from '../../../shared/session/vocabulary-selection';
import { PracticeDatabaseError } from '../errors/practice-errors';
import type { SentenceItem } from '../schemas/sentence-models';

type SentenceItemRow = Omit<SentenceItem, 'example'>;

// What one answer is graded against: the entry's first example sentence,
// the one practice shows, with its German translation.
export type SentenceTarget = {
  readonly targetLanguage: LanguageCode;
  readonly word: { readonly target: string; readonly german: string };
  readonly sentence: string;
  readonly reference: string;
};

type SentenceTargetRow = {
  readonly targetLanguage: LanguageCode;
  readonly targetText: string;
  readonly nativeText: string;
  readonly sentence: string;
  readonly reference: string;
};

export class SentenceStore extends Context.Tag('wordhold/SentenceStore')<
  SentenceStore,
  {
    readonly loadSession: (
      courseId: string,
      selection: VocabularySelectionData,
    ) => Effect.Effect<ReadonlyArray<SentenceItemRow>, PracticeDatabaseError>;
    readonly readTarget: (
      entryId: string,
    ) => Effect.Effect<SentenceTarget | undefined, PracticeDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    SentenceStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      // Only words the learner has met in either direction, so a sentence
      // never practises a word they have not seen. A random draw keeps
      // repeated rounds from always starting with the same sentences.
      const loadSession = (
        courseId: string,
        selection: VocabularySelectionData,
      ) =>
        sql<SentenceItemRow>`
          select e.id as "entryId", e.target_text as "targetText",
            e.native_text as "nativeText"
          from entries e
          join courses co on co.id = e.course_id
          where e.course_id = ${courseId}
            and co.kind = 'language'
            and ${selectedEntries(sql, selection)}
            and exists (
              select 1 from cards c
              where c.entry_id = e.id and c.introduced_at is not null
            )
          order by random()
          limit ${sessionSectionSize}
        `.pipe(
          Effect.mapError(
            (cause) =>
              new PracticeDatabaseError({
                operation: 'load sentence practice',
                cause,
                message: 'Die Satzübung konnte nicht geladen werden.',
              }),
          ),
        );
      const readTarget = (entryId: string) =>
        sql<SentenceTargetRow>`
          select co.target_language as "targetLanguage",
            e.target_text as "targetText", e.native_text as "nativeText",
            example.native_text as sentence, example.target_text as reference
          from entries e
          join courses co on co.id = e.course_id
          join lateral (
            select target_text, native_text
            from entry_examples
            where entry_id = e.id
            order by position, id
            limit 1
          ) example on true
          where e.id = ${entryId}
            and co.kind = 'language'
            and example.native_text is not null
        `.pipe(
          Effect.map(([row]) =>
            row === undefined
              ? undefined
              : {
                  targetLanguage: row.targetLanguage,
                  word: { target: row.targetText, german: row.nativeText },
                  sentence: row.sentence,
                  reference: row.reference,
                },
          ),
          Effect.mapError(
            (cause) =>
              new PracticeDatabaseError({
                operation: 'read sentence',
                cause,
                message: 'Der Satz konnte nicht geladen werden.',
              }),
          ),
        );
      return { loadSession, readTarget } as const;
    }),
  );
}
