import { readMigrationFiles } from 'drizzle-orm/migrator';
import { PgDialect } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { Config, Effect, Redacted } from 'effect';
import postgres from 'postgres';
import { backfillUnits } from './migrations/backfill-units';
import { MigrationError } from './migrations/migration-error';

const migrationsFolder = `${import.meta.dir}/../drizzle`;
const unitBackfillMigrationIndex = 4;
const migrationLockName = 'wordhold-database-migrations';

export const migrateDatabase = (
  url: string,
  lastMigrationIndex = Number.POSITIVE_INFINITY,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => postgres(url, { max: 1 })),
    (client) =>
      Effect.tryPromise({
        try: async () => {
          await client`select pg_advisory_lock(hashtext(${migrationLockName}))`;
          try {
            const database = drizzle(client);
            const dialect = new PgDialect();
            const migrationSession = database._
              .session as unknown as Parameters<PgDialect['migrate']>[1];
            const config = { migrationsFolder };
            const selectedMigrations = readMigrationFiles(config).slice(
              0,
              lastMigrationIndex + 1,
            );
            if (lastMigrationIndex < unitBackfillMigrationIndex) {
              await dialect.migrate(
                selectedMigrations,
                migrationSession,
                config,
              );
            } else {
              await dialect.migrate(
                selectedMigrations.slice(0, unitBackfillMigrationIndex + 1),
                migrationSession,
                config,
              );
              await backfillUnits(client);
              await dialect.migrate(
                selectedMigrations,
                migrationSession,
                config,
              );
            }
          } finally {
            await client`select pg_advisory_unlock(hashtext(${migrationLockName}))`;
          }
        },
        catch: (cause) =>
          cause instanceof MigrationError
            ? cause
            : new MigrationError({
                cause,
                message: 'Database migration failed.',
              }),
      }),
    (client) => Effect.promise(() => client.end()),
  );

if (import.meta.main) {
  const program = Effect.flatMap(Config.redacted('DATABASE_URL'), (url) =>
    migrateDatabase(Redacted.value(url)),
  );
  await Effect.runPromise(program);
}
