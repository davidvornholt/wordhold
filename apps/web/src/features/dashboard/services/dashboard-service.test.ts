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
      courseCounts: () => Effect.fail(failure),
      fragileEntries: () => Effect.fail(failure),
      activityBetween: () => Effect.fail(failure),
    });
    const result = await Effect.runPromise(
      Effect.flatMap(DashboardService, (service) =>
        service.load('Europe/Berlin'),
      ).pipe(
        Effect.provide(DashboardService.Default.pipe(Layer.provide(store))),
        Effect.either,
      ),
    );
    expect(result._tag).toBe('Left');
    const receivedFailure = result._tag === 'Left' ? result.left : undefined;
    expect(receivedFailure).toBe(failure);
  });
});
