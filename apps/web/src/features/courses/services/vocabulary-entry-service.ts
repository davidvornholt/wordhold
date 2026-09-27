import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  CourseBookNotFoundError,
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
import { VocabularyEntryStore, type WordPlace } from './vocabulary-entry-store';

export type CreatedVocabularyEntry = {
  readonly entryId: string;
  // The entry is stored either way; only the pronunciation can be missing.
  readonly audio: 'generated' | 'failed';
};

const courseMissing = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
});

const placeMissing = ({ unitId }: WordPlace) =>
  unitId === null
    ? new CourseBookNotFoundError({
        message: 'Dieses Buch gibt es nicht mehr. Lade die Seite neu.',
      })
    : new CourseUnitNotFoundError({
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
            case 'place-missing':
              return yield* placeMissing(input);
            case 'duplicate':
              return yield* new VocabularyEntryConflictError({
                targetText: input.targetText,
                message: `„${input.targetText}“ ist schon in ${result.location} gespeichert.`,
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
        bookId,
        unitId,
        ...word
      }: VocabularyTranslationSuggestionData) =>
        Effect.gen(function* () {
          const place = yield* store.readPlace(courseId, { bookId, unitId });
          if (place === undefined) {
            return yield* placeMissing({ bookId, unitId });
          }
          return yield* suggestDraftTranslation(
            generator,
            place.targetLanguage,
            place.unitName,
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
