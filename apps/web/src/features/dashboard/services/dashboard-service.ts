import { Clock, Effect } from 'effect';
import type { DashboardData } from '../schemas/dashboard-models';
import { DashboardStore } from './dashboard-store';
import { ownerDayBounds } from './day-boundary';

export class DashboardService extends Effect.Service<DashboardService>()(
  'wordhold/DashboardService',
  {
    effect: Effect.gen(function* () {
      const store = yield* DashboardStore;
      const load = (timeZone: string) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const { startInclusive, endExclusive } = ownerDayBounds(
            now,
            timeZone,
          );
          const [perCourse, fragile, activity] = yield* Effect.all(
            [
              store.courseCounts(now),
              store.fragileEntries(),
              store.activityBetween(startInclusive, endExclusive),
            ] as const,
            { concurrency: 'unbounded' },
          );
          return {
            perCourse,
            fragile,
            reviewsToday: activity.answers,
            cardsToday: activity.cards,
          } satisfies DashboardData;
        });
      return { load } as const;
    }),
  },
) {}
