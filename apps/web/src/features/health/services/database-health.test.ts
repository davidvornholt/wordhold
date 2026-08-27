import { expect, it } from 'bun:test';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { checkDatabaseHealth } from './database-health';

it('reports healthy when PostgreSQL accepts a query', async () => {
  const result = await Effect.runPromise(
    withTestDatabase((database) =>
      checkDatabaseHealth.pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );
  expect(result).toBeUndefined();
});
