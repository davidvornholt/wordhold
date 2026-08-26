import { Clock, Effect } from 'effect';
import { LearningUnitNotFoundError } from '../errors/learning-errors';
import { LearningStore } from './learning-store';

export class LearningService extends Effect.Service<LearningService>()(
  'wordhold/LearningService',
  {
    effect: Effect.gen(function* () {
      const store = yield* LearningStore;
      const getPass = (unitId: string) =>
        Effect.gen(function* () {
          const pass = yield* store.loadPass(unitId);
          return pass === undefined
            ? yield* new LearningUnitNotFoundError({
                message: 'Einheit nicht gefunden.',
              })
            : pass;
        });
      const introduce = (entryId: string) =>
        Effect.gen(function* () {
          const at = new Date(yield* Clock.currentTimeMillis);
          yield* store.introduce(entryId, at);
        });
      return { getPass, introduce } as const;
    }),
  },
) {}
