import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { DashboardDatabaseError } from '../errors/dashboard-errors';
import { DashboardService } from './dashboard-service';
import { DashboardStore } from './dashboard-store';

describe('DashboardService', () => {
  it('retains its typed database failure', async () => {
    const failure = new DashboardDatabaseError({
      cause: 'offline',
      message: 'dashboard unavailable',
    });
    const store = Layer.succeed(DashboardStore, {
      courses: () => Effect.fail(failure),
      courseCounts: () => Effect.fail(failure),
      fragileEntries: () => Effect.fail(failure),
      activityBetween: () => Effect.fail(failure),
      practicedDays: () => Effect.fail(failure),
    });
    const result = await Effect.runPromise(
      Effect.flatMap(DashboardService, (service) =>
        service.load('owner', 'Europe/Berlin'),
      ).pipe(
        Effect.provide(DashboardService.Default.pipe(Layer.provide(store))),
        Effect.either,
      ),
    );
    expect(result._tag).toBe('Left');
    const receivedFailure = result._tag === 'Left' ? result.left : undefined;
    expect(receivedFailure).toBe(failure);
  });

  it('asks the store about the given person only', async () => {
    const askedFor: Array<string> = [];
    const answer =
      <A>(value: A) =>
      (ownerId: string) =>
        Effect.sync(() => {
          askedFor.push(ownerId);
          return value;
        });
    const store = Layer.succeed(DashboardStore, {
      courses: answer([]),
      courseCounts: answer([]),
      fragileEntries: answer([]),
      activityBetween: answer({ answers: 0, cards: 0 }),
      practicedDays: answer([]),
    });
    await Effect.runPromise(
      Effect.flatMap(DashboardService, (service) =>
        service.load('owner', 'Europe/Berlin'),
      ).pipe(
        Effect.provide(DashboardService.Default.pipe(Layer.provide(store))),
      ),
    );
    expect(askedFor).toEqual(['owner', 'owner', 'owner', 'owner']);
  });
});
