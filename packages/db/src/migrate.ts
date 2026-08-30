import { sql } from 'drizzle-orm';
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

const backfillImportExpectedCounts = (
  database: ReturnType<typeof makeDrizzle>,
) =>
  Effect.tryPromise({
    try: async () => {
      const columns = await database.execute<{ readonly present: number }>(sql`
        select 1 as present
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'pages'
          and column_name = 'import_expected_count'
        limit 1
      `);
      if (columns.length === 0) {
        return;
      }
      await database.execute(sql`
        update pages as page
        set import_expected_count = counts.page_count
        from (
          select import_session_id,
            greatest(count(*)::integer, max(import_position) + 1)::integer as page_count
          from pages
          group by import_session_id
        ) as counts
        where page.import_session_id = counts.import_session_id
          and page.import_expected_count = 1
          and counts.page_count > 1
      `);
    },
    catch: migrationError,
  });

const validateImportPositionConstraint = (
  database: ReturnType<typeof makeDrizzle>,
) =>
  Effect.tryPromise({
    try: () =>
      database.execute(
        sql`alter table pages validate constraint pages_import_position_within_expected_count`,
      ),
    catch: migrationError,
  });

export const migrateDatabase = (url: string) =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => makeDrizzle(url),
      catch: migrationError,
    }),
    (database) =>
      backfillImportExpectedCounts(database).pipe(
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () => migrate(database, { migrationsFolder }),
            catch: migrationError,
          }),
        ),
        Effect.flatMap(() => backfillImportExpectedCounts(database)),
        Effect.flatMap(() => validateImportPositionConstraint(database)),
      ),
    (database) => Effect.promise(() => database.$client.end()),
  );
