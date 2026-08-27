import { expect, it } from 'bun:test';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer, Ref } from 'effect';
import { makeHealthHandler } from './health';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

it('returns 503 while PostgreSQL is unavailable and 200 after it recovers', async () => {
  await Effect.runPromise(
    withTestDatabase((database) =>
      Effect.gen(function* () {
        const databaseAvailable = yield* Ref.make(false);
        const recoverableDatabaseLayer = Layer.unwrapEffect(
          Ref.get(databaseAvailable).pipe(
            Effect.flatMap((isAvailable) =>
              isAvailable
                ? Effect.succeed(testDatabaseLayer(database.url))
                : Effect.fail(new Error('PostgreSQL is unavailable.')),
            ),
          ),
        );
        const handleHealthRequest = makeHealthHandler(recoverableDatabaseLayer);

        const unavailableResponse = yield* Effect.promise(() =>
          handleHealthRequest(),
        );
        yield* Ref.set(databaseAvailable, true);
        const recoveredResponse = yield* Effect.promise(() =>
          handleHealthRequest(),
        );
        const unavailableBody = yield* Effect.promise(() =>
          unavailableResponse.json(),
        );
        const recoveredBody = yield* Effect.promise(() =>
          recoveredResponse.json(),
        );

        expect(unavailableResponse.status).toBe(HTTP_SERVICE_UNAVAILABLE);
        expect(unavailableResponse.headers.get('cache-control')).toBe(
          'no-store',
        );
        expect(unavailableBody).toEqual({ status: 'unhealthy' });
        expect(recoveredResponse.status).toBe(HTTP_OK);
        expect(recoveredResponse.headers.get('cache-control')).toBe('no-store');
        expect(recoveredBody).toEqual({ status: 'ok' });
      }),
    ),
  );
});
