import { SpellingPitfalls } from '@wordhold/ai/pitfalls';
import { maximumPitfallBatch } from '@wordhold/ai/pitfalls/schema';
import type { AiUsage } from '@wordhold/ai/usage';
import { Context, Effect, Layer } from 'effect';
import { englishNames } from '../../../shared/languages';
import type { PreparedEntryPitfalls } from '../../../shared/pitfalls/pitfall-model';
import type { CourseDatabaseError } from '../errors/courses-errors';
import {
  type PitfallWordContext,
  SpellingPitfallStore,
} from './spelling-pitfall-store';

// Words of one language, at most a batch at a time.
const batches = (
  words: ReadonlyArray<PitfallWordContext>,
): ReadonlyArray<ReadonlyArray<PitfallWordContext>> =>
  [...Map.groupBy(words, (word) => word.targetLanguage).values()].flatMap(
    (group) =>
      Array.from(
        { length: Math.ceil(group.length / maximumPitfallBatch) },
        (_, index) =>
          group.slice(
            index * maximumPitfallBatch,
            (index + 1) * maximumPitfallBatch,
          ),
      ),
  );

export class SpellingPitfallService extends Context.Service<
  SpellingPitfallService,
  {
    // The pitfalls of the named words, found and stored first for those
    // that have none yet. Terms and texts are left out, and so is a word
    // whose pitfalls could not be found or that was respelled meanwhile:
    // practice goes on without them, and the next pass asks again.
    readonly prepare: (
      entryIds: ReadonlyArray<string>,
    ) => Effect.Effect<
      ReadonlyArray<PreparedEntryPitfalls>,
      CourseDatabaseError,
      AiUsage
    >;
  }
>()('wordhold/SpellingPitfallService') {
  static readonly layer = Layer.effect(
    SpellingPitfallService,
    Effect.gen(function* () {
      const store = yield* SpellingPitfallStore;
      const pitfalls = yield* SpellingPitfalls;

      const derive = (words: ReadonlyArray<PitfallWordContext>) =>
        Effect.gen(function* () {
          const [first] = words;
          if (first === undefined) {
            return [];
          }
          const found = yield* pitfalls.find({
            targetLanguage: englishNames[first.targetLanguage],
            words,
          });
          const stored = yield* Effect.forEach(words, (word, index) => {
            const wordPitfalls = found[index] ?? [];
            return store
              .save({
                entryId: word.entryId,
                targetText: word.targetText,
                pitfalls: wordPitfalls,
              })
              .pipe(
                Effect.map((saved) =>
                  saved
                    ? [
                        {
                          entryId: word.entryId,
                          targetText: word.targetText,
                          pitfalls: wordPitfalls,
                        },
                      ]
                    : [],
                ),
              );
          });
          return stored.flat();
        }).pipe(
          Effect.catchTag('SpellingPitfallError', () => Effect.succeed([])),
        );

      const prepare = (entryIds: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const words = yield* store.read(entryIds);
          const known = words.flatMap((word) =>
            word.pitfalls === null
              ? []
              : [
                  {
                    entryId: word.entryId,
                    targetText: word.targetText,
                    pitfalls: word.pitfalls,
                  },
                ],
          );
          const derived = yield* Effect.forEach(
            batches(words.filter((word) => word.pitfalls === null)),
            derive,
          );
          return [...known, ...derived.flat()];
        });

      return SpellingPitfallService.of({ prepare });
    }),
  );
}
