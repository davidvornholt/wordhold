import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  CourseBookNotFoundError,
  CourseKindMismatchError,
  CourseSettingsNotFoundError,
  CourseUnitNotFoundError,
  VocabularyEntryConflictError,
  VocabularyEntryNotFoundError,
} from '../errors/courses-errors';
import type {
  DeleteEntryData,
  UpdateVocabularyEntryData,
} from '../schemas/entry-changes';
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
import { prepareEntryAudio, removeEntryFiles } from './vocabulary-entry-audio';
import { VocabularyEntryStore, type WordPlace } from './vocabulary-entry-store';

export type CreatedVocabularyEntry = {
  readonly entryId: string;
  // The entry is stored either way; only the pronunciation can be missing.
  readonly audio: 'generated' | 'failed';
};

export type UpdatedVocabularyEntry = {
  // A changed word needs new pronunciation; otherwise the stored one is kept.
  readonly audio: 'generated' | 'failed' | 'kept';
};

const courseMissing = new CourseSettingsNotFoundError({
  message: 'Sprache oder Fach nicht gefunden.',
});

// A subject's terms have a definition instead of a translation, and no
// example sentences or pronunciation.
const notLanguage = new CourseKindMismatchError({
  message: 'In einem Fach trägst du Begriffe mit Definition ein.',
});

const entryMissing = new VocabularyEntryNotFoundError({
  message: 'Diese Vokabel gibt es nicht mehr. Lade die Seite neu.',
});

const duplicateWord = (targetText: string, location: string) =>
  new VocabularyEntryConflictError({
    targetText,
    message: `„${targetText}“ ist schon in ${location} gespeichert.`,
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
        Effect.gen(function* () {
          const course = yield* store.readCourse(courseId);
          if (course === undefined) {
            return yield* courseMissing;
          }
          return course.kind === 'terms'
            ? yield* notLanguage
            : course.targetLanguage;
        });

      const create = (input: CreateVocabularyEntryData) =>
        Effect.gen(function* () {
          const language = yield* targetLanguage(input.courseId);
          const result = yield* store.create(input);
          switch (result.kind) {
            case 'place-missing':
              return yield* placeMissing(input);
            case 'duplicate':
              return yield* duplicateWord(input.targetText, result.location);
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

      const update = (input: UpdateVocabularyEntryData) =>
        Effect.gen(function* () {
          const language = yield* targetLanguage(input.courseId);
          const result = yield* store.update(input);
          if (result.kind === 'entry-missing') {
            return yield* entryMissing;
          }
          if (result.kind === 'duplicate') {
            return yield* duplicateWord(input.targetText, result.location);
          }
          yield* removeEntryFiles(storage, result.unreferencedFiles);
          const audio = result.wordChanged
            ? yield* prepareEntryAudio(
                { tts, storage, store },
                input.entryId,
                input.targetText,
                language,
              )
            : 'kept';
          return { audio } satisfies UpdatedVocabularyEntry;
        });

      // Words and terms alike.
      const remove = (input: DeleteEntryData) =>
        Effect.gen(function* () {
          const removed = yield* store.remove(input);
          yield* removeEntryFiles(storage, removed.unreferencedFiles);
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
          if (place.kind === 'terms') {
            return yield* notLanguage;
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
        update,
        remove,
        generateExample,
        translateExample,
        suggestTranslation,
      } as const;
    }),
  },
) {}
