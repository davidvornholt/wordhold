import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';

export type PitfallWordContext = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
  readonly pitfalls: ReadonlyArray<SpellingPitfall> | null;
};

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Stolperstellen konnten nicht gespeichert werden.',
  });

export class SpellingPitfallStore extends Context.Service<
  SpellingPitfallStore,
  {
    // The named words of language courses, in no particular order. Terms
    // and texts are left out.
    readonly read: (
      entryIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<PitfallWordContext>, CourseDatabaseError>;
    // Resolves to whether the pitfalls were stored. They are not when the
    // word was respelled since it was read, or already has its pitfalls.
    readonly save: (word: {
      readonly entryId: string;
      readonly targetText: string;
      readonly pitfalls: ReadonlyArray<SpellingPitfall>;
    }) => Effect.Effect<boolean, CourseDatabaseError>;
  }
>()('wordhold/SpellingPitfallStore') {
  static readonly live = Layer.effect(
    SpellingPitfallStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const read = (entryIds: ReadonlyArray<string>) =>
        sql<PitfallWordContext>`
          select e.id as "entryId", e.target_text as "targetText",
            e.native_text as "nativeText",
            co.target_language as "targetLanguage",
            e.spelling_pitfalls as pitfalls
          from entries e
          join courses co on co.id = e.course_id
          where co.kind = 'language'
            and e.id = any(${`{${entryIds.join(',')}}`}::uuid[])
        `.pipe(Effect.mapError((cause) => databaseError('read words', cause)));

      const save = ({
        entryId,
        targetText,
        pitfalls,
      }: {
        readonly entryId: string;
        readonly targetText: string;
        readonly pitfalls: ReadonlyArray<SpellingPitfall>;
      }) =>
        sql<{ readonly id: string }>`
          update entries
          set spelling_pitfalls = ${JSON.stringify(pitfalls)}::jsonb
          where id = ${entryId} and target_text = ${targetText}
            and spelling_pitfalls is null
          returning id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError((cause) => databaseError('save pitfalls', cause)),
        );

      return SpellingPitfallStore.of({ read, save });
    }),
  );
}
