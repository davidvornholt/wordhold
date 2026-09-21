import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Cause, Effect } from 'effect';
import {
  speechAudioProfile,
  synthesizeSpeechAudio,
} from '../../../shared/audio/speech-audio';
import { persistFileReference } from '../../../shared/storage/consistency';
import { audioRelativePath, Storage } from '../../../shared/storage/server';
import {
  CourseSettingsNotFoundError,
  CourseUnitNotFoundError,
  VocabularyEntryConflictError,
} from '../errors/courses-errors';
import type {
  CreateVocabularyEntryData,
  VocabularyExampleRequestData,
  VocabularyTranslationRequestData,
} from '../schemas/vocabulary-entry-creation';
import {
  generateDraftExample,
  translateDraftExample,
} from './vocabulary-draft-examples';
import { VocabularyEntryStore } from './vocabulary-entry-store';

export type CreatedVocabularyEntry = {
  readonly entryId: string;
  // The entry is stored either way; only the pronunciation can be missing.
  readonly audio: 'generated' | 'failed';
};

const courseMissing = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
});

export class VocabularyEntryService extends Effect.Service<VocabularyEntryService>()(
  'wordhold/VocabularyEntryService',
  {
    effect: Effect.gen(function* () {
      const store = yield* VocabularyEntryStore;
      const generator = yield* SentenceGen;
      const storage = yield* Storage;
      const tts = yield* Tts;

      const targetLanguage = (courseId: string) =>
        Effect.flatMap(
          store.readTargetLanguage(courseId),
          (
            language,
          ): Effect.Effect<LanguageCode, CourseSettingsNotFoundError> =>
            language === undefined
              ? Effect.fail(courseMissing)
              : Effect.succeed(language),
        );

      // Pronunciation is generated right away like after an import. A failure
      // is reported, not raised: the word is already stored and learnable.
      const prepareAudio = (
        entryId: string,
        targetText: string,
        language: LanguageCode,
      ) =>
        Effect.gen(function* () {
          const audioProfile = speechAudioProfile(targetText, language);
          const result = yield* synthesizeSpeechAudio(
            tts,
            targetText,
            language,
          );
          const path = audioRelativePath(entryId, audioProfile);
          yield* persistFileReference({
            write: storage.write(path, result.audio),
            persistReference: store.storeAudio(entryId, audioProfile, path),
            remove: storage.remove(path),
          });
          return 'generated' as const;
        }).pipe(
          Effect.tapErrorCause((cause) =>
            Effect.logWarning(
              'entry audio generation failed',
              Cause.pretty(cause, { renderErrorCause: true }),
            ),
          ),
          Effect.catchAll(() => Effect.succeed('failed' as const)),
        );

      const create = (input: CreateVocabularyEntryData) =>
        Effect.gen(function* () {
          const language = yield* targetLanguage(input.courseId);
          const result = yield* store.create(input);
          switch (result.kind) {
            case 'unit-missing':
              return yield* new CourseUnitNotFoundError({
                message:
                  'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
              });
            case 'duplicate':
              return yield* new VocabularyEntryConflictError({
                targetText: input.targetText,
                message: `„${input.targetText}“ ist schon in dieser Einheit gespeichert.`,
              });
            case 'created':
              return {
                entryId: result.entryId,
                audio: yield* prepareAudio(
                  result.entryId,
                  input.targetText,
                  language,
                ),
              } satisfies CreatedVocabularyEntry;
            default:
              return result satisfies never;
          }
        });

      const generateExample = ({
        courseId,
        ...word
      }: VocabularyExampleRequestData) =>
        Effect.flatMap(targetLanguage(courseId), (language) =>
          generateDraftExample(generator, language, word),
        );

      const translateExample = ({
        courseId,
        targetText,
      }: VocabularyTranslationRequestData) =>
        Effect.flatMap(targetLanguage(courseId), (language) =>
          translateDraftExample(generator, language, targetText),
        );

      return { create, generateExample, translateExample } as const;
    }),
  },
) {}
