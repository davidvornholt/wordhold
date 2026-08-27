import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Data, Effect } from 'effect';
import { makeDrizzle } from './drizzle';

const migrationsFolder = `${import.meta.dir}/../drizzle`;

export class DatabaseMigrationError extends Data.TaggedError(
  'DatabaseMigrationError',
)<{
  readonly message: string;
}> {}

export const migrateDatabase = (url: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeDrizzle(url)),
    (database) =>
      Effect.tryPromise({
        try: () => migrate(database, { migrationsFolder }),
        catch: () =>
          new DatabaseMigrationError({
            message: 'Could not apply the Wordhold database migrations.',
          }),
      }),
    (database) => Effect.promise(() => database.$client.end()),
  );
