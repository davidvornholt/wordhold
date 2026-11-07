import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { DashboardService } from './dashboard-service';
import { DashboardStore } from './dashboard-store';

// Shared by the dashboard's server functions and the CLI's API.
export const dashboardRuntime = ManagedRuntime.make(
  DashboardService.layer.pipe(
    Layer.provide(DashboardStore.live.pipe(Layer.provide(PgLive))),
  ),
);
