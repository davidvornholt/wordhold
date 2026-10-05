import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import type { AiUsage } from '@wordhold/ai/usage';
import { Context, Effect, Layer } from 'effect';
import type { CourseDatabaseError } from '../errors/courses-errors';
import {
  CourseKindMismatchError,
  CourseSettingsNotFoundError,
  TermAssistError,
  VocabularyEntryConflictError,
  VocabularyEntryNotFoundError,
} from '../errors/courses-errors';
import type { UpdateTermEntryData } from '../schemas/entry-changes';
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

const duplicateTerm = (term: string) =>
  new VocabularyEntryConflictError({
    targetText: term,
    message: `„${term}“ ist in diesem Fach schon eingetragen.`,
  });

const suggestionFailed = new TermAssistError({
  message:
    'Die Definition konnte nicht vorgeschlagen werden. Schreib sie selbst oder versuche es noch einmal.',
});

const keyPointsFailed = new TermAssistError({
  message:
    'Die Kernpunkte konnten nicht bestimmt werden. Versuche es noch einmal oder trage sie selbst ein.',
});

export class TermEntryService extends Context.Service<
  TermEntryService,
  {
    readonly create: (
      input: CreateTermEntryData,
    ) => Effect.Effect<
      { entryId: string },
      | CourseDatabaseError
      | CourseSettingsNotFoundError
      | CourseKindMismatchError
      | VocabularyEntryConflictError
    >;
    readonly update: (
      input: UpdateTermEntryData,
    ) => Effect.Effect<
      { definitionChanged: boolean },
      | CourseDatabaseError
      | VocabularyEntryConflictError
      | VocabularyEntryNotFoundError
    >;
    readonly suggestDefinition: (
      input: TermDefinitionSuggestionData,
    ) => Effect.Effect<
      { definition: string },
      | CourseDatabaseError
      | CourseSettingsNotFoundError
      | CourseKindMismatchError
      | TermAssistError,
      AiUsage
    >;
    readonly deriveKeyPoints: (
      input: TermKeyPointsRequestData,
    ) => Effect.Effect<
      { keyPoints: ReadonlyArray<string> },
      CourseDatabaseError | VocabularyEntryNotFoundError | TermAssistError,
      AiUsage
    >;
    readonly updateKeyPoints: (
      input: UpdateTermKeyPointsData,
    ) => Effect.Effect<
      { keyPoints: ReadonlyArray<string> },
      CourseDatabaseError | VocabularyEntryNotFoundError
    >;
  }
>()('wordhold/TermEntryService') {
  static readonly layer = Layer.effect(
    TermEntryService,
    Effect.gen(function* () {
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
              return yield* duplicateTerm(input.term);
            case 'created':
              return { entryId: result.entryId };
            default:
              return result satisfies never;
          }
        });

      // A changed definition has no key points until they are derived again,
      // which the caller starts as after a new term.
      const update = (input: UpdateTermEntryData) =>
        Effect.gen(function* () {
          const result = yield* store.update(input);
          switch (result.kind) {
            case 'term-missing':
              return yield* termMissing;
            case 'duplicate':
              return yield* duplicateTerm(input.term);
            case 'updated':
              return { definitionChanged: result.definitionChanged };
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

      return TermEntryService.of({
        create,
        update,
        suggestDefinition,
        deriveKeyPoints,
        updateKeyPoints,
      });
    }),
  );
}
