import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  CourseSettingsNotFoundError,
  CourseUnitNotFoundError,
  VocabularyEntryConflictError,
} from '../errors/courses-errors';
import type {
  CreateVocabularyEntryData,
  VocabularyExampleRequestData,
  VocabularyTranslationRequestData,
  VocabularyTranslationSuggestionData,
} from '../schemas/vocabulary-entry-creation';
import {
  generateDraftExample,
  suggestDraftTranslation,
  translateDraftExample,
} from './vocabulary-draft-examples';
import { prepareEntryAudio } from './vocabulary-entry-audio';
import { VocabularyEntryStore } from './vocabulary-entry-store';

export type CreatedVocabularyEntry = {
  readonly entryId: string;
  // The entry is stored either way; only the pronunciation can be missing.
  readonly audio: 'generated' | 'failed';
};

const courseMissing = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
});

const unitMissing = new CourseUnitNotFoundError({
  message: 'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
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
                audio: yield* prepareEntryAudio(
                  { tts, storage, store },
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

      const suggestTranslation = ({
        courseId,
        unitId,
        ...word
      }: VocabularyTranslationSuggestionData) =>
        Effect.gen(function* () {
          const unit = yield* store.readUnit(courseId, unitId);
          if (unit === undefined) {
            return yield* unitMissing;
          }
          return yield* suggestDraftTranslation(
            generator,
            unit.targetLanguage,
            unit.unitName,
            word,
          );
        });

      return {
        create,
        generateExample,
        translateExample,
        suggestTranslation,
      } as const;
    }),
  },
) {}
