import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Effect } from 'effect';
import {
  speechAudioProfile,
  synthesizeSpeechAudio,
} from '../../../shared/audio/speech-audio';
import type { PreparedEntryExample } from '../../../shared/examples/example-model';
import type { englishNames } from '../../../shared/languages';
import { persistFileReference } from '../../../shared/storage/consistency';
import {
  exampleAudioRelativePath,
  Storage,
} from '../../../shared/storage/server';
import { VocabularyEntryNotFoundError } from '../errors/courses-errors';
import {
  completeExampleTranslation,
  generateMissingExample,
  prepareExampleBatch,
} from './vocabulary-example-preparation';
import { VocabularyExampleStore } from './vocabulary-example-store';

export class VocabularyExampleService extends Effect.Service<VocabularyExampleService>()(
  'wordhold/VocabularyExampleService',
  {
    effect: Effect.gen(function* () {
      const store = yield* VocabularyExampleStore;
      const generator = yield* SentenceGen;
      const storage = yield* Storage;
      const tts = yield* Tts;

      const prepareAudio = ({
        entryId,
        targetText,
        targetLanguage,
        cachedProfile,
        cachedPath,
      }: {
        readonly entryId: string;
        readonly targetText: string;
        readonly targetLanguage: keyof typeof englishNames;
        readonly cachedProfile: string | null;
        readonly cachedPath: string | null;
      }) => {
        const audioProfile = speechAudioProfile(targetText, targetLanguage);
        if (cachedPath !== null && cachedProfile === audioProfile) {
          return Effect.succeed(true);
        }
        return Effect.gen(function* () {
          const result = yield* synthesizeSpeechAudio(
            tts,
            targetText,
            targetLanguage,
          );
          const path = exampleAudioRelativePath(entryId, audioProfile);
          yield* persistFileReference({
            write: storage.write(path, result.audio),
            persistReference: store
              .storeAudio(entryId, targetText, audioProfile, path)
              .pipe(
                Effect.flatMap((stored) =>
                  stored
                    ? Effect.void
                    : Effect.fail(
                        new VocabularyEntryNotFoundError({
                          message: 'Vokabel nicht gefunden.',
                        }),
                      ),
                ),
              ),
            remove: storage.remove(path),
          });
          return true;
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));
      };

      const prepareOne = (entryId: string) =>
        store.withCriticalSection(
          entryId,
          Effect.gen(function* () {
            const context = yield* store.read(entryId);
            if (context === undefined) {
              return yield* new VocabularyEntryNotFoundError({
                message: 'Vokabel nicht gefunden.',
              });
            }
            const storedExample =
              context.example ??
              (yield* generateMissingExample(context, generator, store));
            const example = yield* completeExampleTranslation({
              entryId,
              targetLanguage: context.targetLanguage,
              example: storedExample,
              generator,
              store,
            });
            const hasAudio = yield* prepareAudio({
              entryId,
              targetText: example.targetText,
              targetLanguage: context.targetLanguage,
              cachedProfile: context.exampleAudioProfile,
              cachedPath: context.exampleAudioPath,
            });
            return {
              entryId,
              example: { ...example, hasAudio },
            } satisfies PreparedEntryExample;
          }),
        );

      const prepare = (entryIds: ReadonlyArray<string>) =>
        prepareExampleBatch(entryIds, prepareOne);

      const generate = (entryId: string) =>
        prepareOne(entryId).pipe(
          Effect.map(({ example }) => ({
            targetText: example.targetText,
            nativeText: example.nativeText,
            source: example.source,
          })),
        );

      return { generate, prepare } as const;
    }),
  },
) {}
