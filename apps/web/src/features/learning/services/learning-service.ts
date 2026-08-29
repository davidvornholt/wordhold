import { Clock, Effect } from 'effect';
import {
  LearningEntryNotFoundError,
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
      const introduce = (courseId: string, unitId: string, entryId: string) =>
        Effect.gen(function* () {
          const at = new Date(yield* Clock.currentTimeMillis);
          const found = yield* store.introduce(courseId, unitId, entryId, at);
          if (!found) {
            return yield* new LearningEntryNotFoundError({
              message:
                'Die Vokabel gehört nicht mehr zu dieser Einheit. Lade die Seite neu.',
            });
          }
        });
      return { getPass, introduce } as const;
    }),
  },
) {}
