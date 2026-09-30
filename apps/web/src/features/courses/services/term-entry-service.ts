import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Effect } from 'effect';
import {
  CourseKindMismatchError,
  CourseSettingsNotFoundError,
  TermAssistError,
  VocabularyEntryConflictError,
  VocabularyEntryNotFoundError,
} from '../errors/courses-errors';
import type {
  CreateTermEntryData,
  TermDefinitionSuggestionData,
  TermKeyPointsRequestData,
  UpdateTermKeyPointsData,
} from '../schemas/term-entry-creation';
import { TermEntryStore } from './term-entry-store';

const subjectMissing = new CourseSettingsNotFoundError({
  message: 'Dieses Fach gibt es nicht mehr. Lade die Seite neu.',
});

const notTerms = new CourseKindMismatchError({
  message: 'Begriffe mit Definition gibt es nur in einem Fach.',
});

const termMissing = new VocabularyEntryNotFoundError({
  message: 'Diesen Begriff gibt es nicht mehr. Lade die Seite neu.',
});

const suggestionFailed = new TermAssistError({
  message:
    'Die Definition konnte nicht vorgeschlagen werden. Schreib sie selbst oder versuche es noch einmal.',
});

const keyPointsFailed = new TermAssistError({
  message:
    'Die Kernpunkte konnten nicht bestimmt werden. Versuche es noch einmal oder trage sie selbst ein.',
});

export class TermEntryService extends Effect.Service<TermEntryService>()(
  'wordhold/TermEntryService',
  {
    effect: Effect.gen(function* () {
      const store = yield* TermEntryStore;
      const writer = yield* DefinitionWriter;

      const create = (input: CreateTermEntryData) =>
        Effect.gen(function* () {
          const result = yield* store.create(input);
          switch (result.kind) {
            case 'course-missing':
              return yield* subjectMissing;
            case 'not-terms':
              return yield* notTerms;
            case 'duplicate':
              return yield* new VocabularyEntryConflictError({
                targetText: input.term,
                message: `„${input.term}“ ist in diesem Fach schon eingetragen.`,
              });
            case 'created':
              return { entryId: result.entryId };
            default:
              return result satisfies never;
          }
        });

      // The subject's name tells the writer which meaning of the term is
      // meant.
      const suggestDefinition = ({
        courseId,
        term,
      }: TermDefinitionSuggestionData) =>
        Effect.gen(function* () {
          const course = yield* store.readCourse(courseId);
          if (course === undefined) {
            return yield* subjectMissing;
          }
          if (course.kind !== 'terms') {
            return yield* notTerms;
          }
          const { definition } = yield* writer
            .suggest({ term, subject: course.name })
            .pipe(Effect.mapError(() => suggestionFailed));
          return { definition };
        });

      // Runs after a term is saved, so practice does not have to derive the
      // key points on the first answer. Another request may have stored some
      // in the meantime; those win.
      const deriveKeyPoints = ({
        courseId,
        entryId,
      }: TermKeyPointsRequestData) =>
        Effect.gen(function* () {
          const stored = yield* store.readTerm(courseId, entryId);
          if (stored === undefined) {
            return yield* termMissing;
          }
          if (stored.keyPoints !== null) {
            return { keyPoints: stored.keyPoints };
          }
          const derived = yield* writer
            .keyPoints({ term: stored.term, definition: stored.definition })
            .pipe(Effect.mapError(() => keyPointsFailed));
          const saved = yield* store.saveDerivedKeyPoints(
            entryId,
            stored.definition,
            derived.keyPoints,
          );
          return { keyPoints: saved ?? derived.keyPoints };
        });

      const updateKeyPoints = ({
        courseId,
        entryId,
        keyPoints,
      }: UpdateTermKeyPointsData) =>
        Effect.gen(function* () {
          const updated = yield* store.setKeyPoints(
            courseId,
            entryId,
            keyPoints,
          );
          return updated ? { keyPoints } : yield* termMissing;
        });

      return {
        create,
        suggestDefinition,
        deriveKeyPoints,
        updateKeyPoints,
      } as const;
    }),
  },
) {}
