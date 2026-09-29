import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Effect } from 'effect';
import {
  CourseBookNotFoundError,
  CourseKindMismatchError,
  CourseUnitNotFoundError,
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
import type { WordPlace } from './vocabulary-entry-store';

const placeMissing = ({ unitId }: WordPlace) =>
  unitId === null
    ? new CourseBookNotFoundError({
        message: 'Dieses Buch gibt es nicht mehr. Lade die Seite neu.',
      })
    : new CourseUnitNotFoundError({
        message: 'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
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
            case 'place-missing':
              return yield* placeMissing(input);
            case 'not-terms':
              return yield* notTerms;
            case 'duplicate':
              return yield* new VocabularyEntryConflictError({
                targetText: input.term,
                message: `„${input.term}“ ist schon in ${result.location} gespeichert.`,
              });
            case 'created':
              return { entryId: result.entryId };
            default:
              return result satisfies never;
          }
        });

      // The subject and the unit tell the writer which meaning of the term
      // is meant. A book name such as "Allgemein" says nothing about that,
      // so only a unit name is passed on.
      const suggestDefinition = ({
        courseId,
        bookId,
        unitId,
        term,
      }: TermDefinitionSuggestionData) =>
        Effect.gen(function* () {
          const place = yield* store.readPlace(courseId, { bookId, unitId });
          if (place === undefined) {
            return yield* placeMissing({ bookId, unitId });
          }
          if (place.kind !== 'terms') {
            return yield* notTerms;
          }
          const { definition } = yield* writer
            .suggest({
              term,
              subject: place.courseName,
              ...(place.unitName === null ? {} : { topic: place.unitName }),
            })
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
