import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Data, Effect } from 'effect';
import { makeDrizzle } from './drizzle';

const migrationsFolder = `${import.meta.dir}/../drizzle`;

export class DatabaseMigrationError extends Data.TaggedError(
  'DatabaseMigrationError',
)<{
  readonly message: string;
}> {}

const migrationError = () =>
  new DatabaseMigrationError({
    message: 'Could not apply the Wordhold database migrations.',
  });

export const migrateDatabase = (url: string) =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => makeDrizzle(url),
      catch: migrationError,
    }),
    (database) =>
      Effect.tryPromise({
        try: () => migrate(database, { migrationsFolder }),
        catch: migrationError,
      }),
    (database) => Effect.promise(() => database.$client.end()),
  );
