import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { serverEnv } from '../../../shared/env/server';
import { DashboardService } from './dashboard-service';
import { DashboardStore } from './dashboard-store';

const dashboardLive = DashboardService.Default.pipe(
  Layer.provide(DashboardStore.live.pipe(Layer.provide(PgLive))),
);

const dashboardRuntime = ManagedRuntime.make(dashboardLive);

export const getDashboard = createServerFn().handler(async () => {
  await requireSession();
  return dashboardRuntime.runPromise(
    Effect.flatMap(DashboardService, (service) =>
      service.load(serverEnv.ownerTimeZone()),
    ),
  );
});
