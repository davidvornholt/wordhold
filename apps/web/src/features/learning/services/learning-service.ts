import { Clock, Context, Effect, Layer } from 'effect';
import type {
  PlaceSelectionData,
  VocabularySelectionData,
} from '../../../shared/session/vocabulary-selection';
import type { LearningDatabaseError } from '../errors/learning-errors';
import {
  LearningCardNotFoundError,
  LearningPlaceNotFoundError,
} from '../errors/learning-errors';
import type { LearnPass, LearnSelectionPass } from '../schemas/learning-models';
import { LearningStore } from './learning-store';

const placeMissingMessage = (place: PlaceSelectionData | null): string => {
  if (place === null) {
    return 'Sprache, Fach oder Sammlung nicht gefunden.';
  }
  return 'bookId' in place ? 'Buch nicht gefunden.' : 'Einheit nicht gefunden.';
};

export class LearningService extends Context.Service<
  LearningService,
  {
    readonly getPass: (
      courseId: string,
      place: PlaceSelectionData | null,
    ) => Effect.Effect<
      LearnPass,
      LearningDatabaseError | LearningPlaceNotFoundError
    >;
    readonly getSelection: (
      courseId: string,
      selection: VocabularySelectionData,
    ) => Effect.Effect<LearnSelectionPass, LearningDatabaseError>;
    readonly introduce: (
      courseId: string,
      cardId: string,
    ) => Effect.Effect<
      undefined,
      LearningDatabaseError | LearningCardNotFoundError
    >;
  }
>()('wordhold/LearningService') {
  static readonly layer = Layer.effect(
    LearningService,
    Effect.gen(function* () {
      const store = yield* LearningStore;
      const getPass = (courseId: string, place: PlaceSelectionData | null) =>
        Effect.gen(function* () {
          const pass = yield* store.loadPass(courseId, place);
          return pass === undefined
            ? yield* new LearningPlaceNotFoundError({
                message: placeMissingMessage(place),
              })
            : pass;
        });
      const getSelection = (
        courseId: string,
        selection: VocabularySelectionData,
      ) => store.loadSelection(courseId, selection);
      const introduce = (courseId: string, cardId: string) =>
        Effect.gen(function* () {
          const at = new Date(yield* Clock.currentTimeMillis);
          const found = yield* store.introduce(courseId, cardId, at);
          if (!found) {
            return yield* new LearningCardNotFoundError({
              message:
                'Diese Abfragerichtung gibt es nicht mehr. Lade die Seite neu.',
            });
          }
        });
      return LearningService.of({ getPass, getSelection, introduce });
    }),
  );
}
