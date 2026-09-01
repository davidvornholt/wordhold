import { Clock, Effect } from 'effect';
import type { VocabularySelectionData } from '../../../shared/session/vocabulary-selection';
import {
  LearningCardNotFoundError,
  LearningUnitNotFoundError,
} from '../errors/learning-errors';
import { LearningStore } from './learning-store';

export class LearningService extends Effect.Service<LearningService>()(
  'wordhold/LearningService',
  {
    effect: Effect.gen(function* () {
      const store = yield* LearningStore;
      const getPass = (courseId: string, unitId: string) =>
        Effect.gen(function* () {
          const pass = yield* store.loadPass(courseId, unitId);
          return pass === undefined
            ? yield* new LearningUnitNotFoundError({
                message: 'Einheit nicht gefunden.',
              })
            : pass;
        });
      const getSelection = (
        courseId: string,
        selection: VocabularySelectionData,
      ) => store.loadSelection(courseId, selection);
      const introduce = (courseId: string, unitId: string, cardId: string) =>
        Effect.gen(function* () {
          const at = new Date(yield* Clock.currentTimeMillis);
          const found = yield* store.introduce(courseId, unitId, cardId, at);
          if (!found) {
            return yield* new LearningCardNotFoundError({
              message:
                'Diese Abfragerichtung gehört nicht mehr zu der Einheit. Lade die Seite neu.',
            });
          }
        });
      return { getPass, getSelection, introduce } as const;
    }),
  },
) {}
