import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import {
  requestAdministrator,
  requestMember,
} from '../../../shared/auth/member-request';
import { serverEnv } from '../../../shared/env/server';
import { requireString } from '../../../shared/validate/input';
import { dashboardRuntime } from './dashboard-runtime';
import { DashboardService } from './dashboard-service';

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
