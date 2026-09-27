import { Clock, Effect } from 'effect';
import type {
  PlaceSelectionData,
  VocabularySelectionData,
} from '../../../shared/session/vocabulary-selection';
import {
  LearningCardNotFoundError,
  LearningPlaceNotFoundError,
} from '../errors/learning-errors';
import { LearningStore } from './learning-store';

export class LearningService extends Effect.Service<LearningService>()(
  'wordhold/LearningService',
  {
    effect: Effect.gen(function* () {
      const store = yield* LearningStore;
      const getPass = (courseId: string, place: PlaceSelectionData) =>
        Effect.gen(function* () {
          const pass = yield* store.loadPass(courseId, place);
          return pass === undefined
            ? yield* new LearningPlaceNotFoundError({
                message:
                  'bookId' in place
                    ? 'Buch nicht gefunden.'
                    : 'Einheit nicht gefunden.',
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
      return { getPass, getSelection, introduce } as const;
    }),
  },
) {}
