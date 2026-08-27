import { createFileRoute } from '@tanstack/react-router';
import { type Database, PgLive } from '@wordhold/db/client';
import { Effect, type Layer } from 'effect';
import { checkDatabaseHealth } from '../../features/health/services/database-health';

export const makeHealthHandler = <E>(
  databaseLayer: Layer.Layer<Database, E>,
): (() => Promise<Response>) => {
  const healthResponse = checkDatabaseHealth.pipe(
    Effect.provide(databaseLayer),
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

  return () => Effect.runPromise(healthResponse);
};

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: makeHealthHandler(PgLive),
    },
  },
});
