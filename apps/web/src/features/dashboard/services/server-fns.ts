import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  requestAdministrator,
  requestMember,
} from '../../../shared/auth/member-request';
import { serverEnv } from '../../../shared/env/server';
import { requireString } from '../../../shared/validate/input';
import { DashboardService } from './dashboard-service';
import { DashboardStore } from './dashboard-store';

const dashboardLive = DashboardService.layer.pipe(
  Layer.provide(DashboardStore.live.pipe(Layer.provide(PgLive))),
);

const dashboardRuntime = ManagedRuntime.make(dashboardLive);

// Everyone in the family shares the instance's time zone, so "today" and the
// streak mean the same calendar day for all of them.
const loadDashboard = (ownerId: string) =>
  dashboardRuntime.runPromise(
    Effect.flatMap(DashboardService, (service) =>
      service.load(ownerId, serverEnv.ownerTimeZone()),
    ),
  );

export const getDashboard = createServerFn().handler(async () => {
  const member = await requestMember();
  return loadDashboard(member.userId);
});

// Read-only: the administrator sees a person's courses and progress but
// cannot act on them.
export const getPersonProgress = createServerFn()
  .validator(requireString)
  .handler(async ({ data }) => {
    await requestAdministrator();
    return dashboardRuntime.runPromise(
      Effect.flatMap(DashboardService, (service) =>
        service.progress(data, serverEnv.ownerTimeZone()),
      ),
    );
  });
