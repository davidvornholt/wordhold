import { Database } from '@wordhold/db/client';
import { Duration, Effect } from 'effect';
import { DatabaseHealthError } from '../errors/database-health-error';

export const checkDatabaseHealth = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`select 1`;
}).pipe(
  Effect.mapError(
    () =>
      new DatabaseHealthError({
        message: 'The Wordhold database health query failed.',
      }),
  ),
  Effect.timeoutFail({
    duration: Duration.seconds(2),
    onTimeout: () =>
      new DatabaseHealthError({
        message: 'The Wordhold database health query timed out.',
      }),
  }),
);
