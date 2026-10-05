import { Context, Effect, Layer } from 'effect';
import type { CourseDatabaseError } from '../errors/courses-errors';
import {
  CourseKindMismatchError,
  CourseSettingsNotFoundError,
  VocabularyEntryConflictError,
  VocabularyEntryNotFoundError,
} from '../errors/courses-errors';
import type {
  CreateTextEntryData,
  UpdateTextEntryData,
} from '../schemas/text-entry-changes';
import { TextEntryStore } from './text-entry-store';

const collectionMissing = new CourseSettingsNotFoundError({
  message: 'Diese Sammlung gibt es nicht mehr. Lade die Seite neu.',
});

const notTexts = new CourseKindMismatchError({
  message: 'Texte zum Auswendiglernen gibt es nur in einer Sammlung.',
});

const textMissing = new VocabularyEntryNotFoundError({
  message: 'Diesen Text gibt es nicht mehr. Lade die Seite neu.',
});

const duplicateTitle = (title: string) =>
  new VocabularyEntryConflictError({
    targetText: title,
    message: `„${title}“ ist in dieser Sammlung schon eingetragen.`,
  });

export class TextEntryService extends Context.Service<
  TextEntryService,
  {
    readonly create: (
      input: CreateTextEntryData,
    ) => Effect.Effect<
      { entryId: string },
      | CourseDatabaseError
      | CourseSettingsNotFoundError
      | CourseKindMismatchError
      | VocabularyEntryConflictError
    >;
    readonly update: (
      input: UpdateTextEntryData,
    ) => Effect.Effect<
      { title: string },
      | CourseDatabaseError
      | VocabularyEntryConflictError
      | VocabularyEntryNotFoundError
    >;
  }
>()('wordhold/TextEntryService') {
  static readonly layer = Layer.effect(
    TextEntryService,
    Effect.gen(function* () {
      const store = yield* TextEntryStore;

      const create = (input: CreateTextEntryData) =>
        Effect.gen(function* () {
          const result = yield* store.create(input);
          switch (result.kind) {
            case 'course-missing':
              return yield* collectionMissing;
            case 'not-texts':
              return yield* notTexts;
            case 'duplicate':
              return yield* duplicateTitle(input.title);
            case 'created':
              return { entryId: result.entryId };
            default:
              return result satisfies never;
          }
        });

      const update = (input: UpdateTextEntryData) =>
        Effect.gen(function* () {
          const result = yield* store.update(input);
          switch (result.kind) {
            case 'text-missing':
              return yield* textMissing;
            case 'duplicate':
              return yield* duplicateTitle(input.title);
            case 'updated':
              return { title: input.title };
            default:
              return result satisfies never;
          }
        });

      return TextEntryService.of({ create, update });
    }),
  );
}
