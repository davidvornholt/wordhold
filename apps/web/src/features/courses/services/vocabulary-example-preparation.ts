import type { SentenceGen } from '@wordhold/ai/sentence';
import { type Context, Effect } from 'effect';
import type { PreparedEntryExample } from '../../../shared/examples/example-model';
import { englishNames } from '../../../shared/languages';
import {
  CourseExampleGenerationError,
  VocabularyEntryNotFoundError,
} from '../errors/courses-errors';
import type { VocabularyExample } from '../schemas/course-units';
import type {
  VocabularyExampleContext,
  VocabularyExampleStore,
} from './vocabulary-example-store';

type SentenceGenerator = Context.Tag.Service<typeof SentenceGen>;
type ExampleStore = Context.Tag.Service<typeof VocabularyExampleStore>;

const generationFailed = new CourseExampleGenerationError({
  message: 'Der Beispielsatz konnte nicht erzeugt werden.',
});
const preparationConcurrency = 3;

export const prepareExampleBatch = <E, R>(
  entryIds: ReadonlyArray<string>,
  prepareOne: (entryId: string) => Effect.Effect<PreparedEntryExample, E, R>,
) =>
  Effect.forEach(
    [...new Set(entryIds)],
    (entryId) =>
      prepareOne(entryId).pipe(
        Effect.catchAll(() =>
          Effect.succeed({ entryId, example: null } as const),
        ),
      ),
    { concurrency: preparationConcurrency },
  );

export const generateMissingExample = (
  context: VocabularyExampleContext,
  generator: SentenceGenerator,
  store: ExampleStore,
) =>
  Effect.gen(function* () {
    const batch = yield* generator
      .generate({
        targetText: context.targetText,
        nativeText: context.nativeText,
        targetLanguage: englishNames[context.targetLanguage],
        count: 1,
      })
      .pipe(Effect.mapError(() => generationFailed));
    const [generated] = batch.sentences;
    if (generated === undefined) {
      return yield* generationFailed;
    }
    const stored = yield* store.storeGenerated(context.entryId, {
      targetText: generated.target,
      nativeText: generated.native,
    });
    if (stored === undefined) {
      return yield* new VocabularyEntryNotFoundError({
        message: 'Vokabel nicht gefunden.',
      });
    }
    return stored;
  });

export const completeExampleTranslation = ({
  entryId,
  example,
  generator,
  store,
  targetLanguage,
}: {
  readonly entryId: string;
  readonly example: VocabularyExample;
  readonly generator: SentenceGenerator;
  readonly store: ExampleStore;
  readonly targetLanguage: VocabularyExampleContext['targetLanguage'];
}) => {
  if (example.nativeText !== null) {
    return Effect.succeed(example);
  }
  return Effect.gen(function* () {
    const translated = yield* generator.translate({
      targetText: example.targetText,
      targetLanguage: englishNames[targetLanguage],
    });
    const stored = yield* store.storeTranslation(
      entryId,
      example.targetText,
      translated.native,
    );
    return stored ? { ...example, nativeText: translated.native } : example;
  }).pipe(Effect.catchAll(() => Effect.succeed(example)));
};
