import { Clock, Effect } from 'effect';
import type { DashboardData } from '../schemas/dashboard-models';
import { DashboardStore } from './dashboard-store';
import { ownerDayBounds } from './day-boundary';
import { ownerWeek, practiceStreak } from './practice-days';

// How far back a streak is followed. Longer streaks are capped at this
// window rather than paid for with an unbounded scan.
const streakWindowDays = 400;
const millisecondsPerDay = 86_400_000;

export class DashboardService extends Effect.Service<DashboardService>()(
  'wordhold/DashboardService',
  {
    effect: Effect.gen(function* () {
      const store = yield* DashboardStore;
      const load = (ownerId: string, timeZone: string) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const { startInclusive, endExclusive } = ownerDayBounds(
            now,
            timeZone,
          );
          const streakStart = new Date(
            startInclusive.getTime() - streakWindowDays * millisecondsPerDay,
          );
          const [perCourse, fragile, activity, practicedDays] =
            yield* Effect.all(
              [
                store.courseCounts(ownerId, now),
                store.fragileEntries(ownerId),
                store.activityBetween(ownerId, startInclusive, endExclusive),
                store.practicedDays(ownerId, streakStart, timeZone),
              ] as const,
              { concurrency: 'unbounded' },
            );
          const practiced = new Set(practicedDays);
          return {
            perCourse,
            fragile,
            reviewsToday: activity.answers,
            cardsToday: activity.cards,
            week: ownerWeek(now, timeZone, practiced),
            streak: practiceStreak(now, timeZone, practiced),
          } satisfies DashboardData;
        });
      // What the administrator sees of another person: the same numbers as
      // that person's overview, with every course named.
      const progress = (ownerId: string, timeZone: string) =>
        Effect.all(
          {
            courses: store.courses(ownerId),
            dashboard: load(ownerId, timeZone),
          },
          { concurrency: 'unbounded' },
        );
      return { load, progress } as const;
    }),
  },
) {}
