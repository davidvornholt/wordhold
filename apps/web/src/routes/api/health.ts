import { createFileRoute } from '@tanstack/react-router';
import { PgLive } from '@wordhold/db/client';
import { Effect, ManagedRuntime } from 'effect';
import { checkDatabaseHealth } from '../../features/health/services/database-health';

const healthRuntime = ManagedRuntime.make(PgLive);

const healthResponse = checkDatabaseHealth.pipe(
  Effect.match({
    onFailure: () =>
      Response.json(
        { status: 'unhealthy' },
        { headers: { 'cache-control': 'no-store' }, status: 503 },
      ),
    onSuccess: () =>
      Response.json(
        { status: 'ok' },
        { headers: { 'cache-control': 'no-store' } },
      ),
  }),
);

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => healthRuntime.runPromise(healthResponse),
    },
  },
});
