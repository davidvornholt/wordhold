import { expect, it } from 'bun:test';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Config, ConfigProvider, Effect } from 'effect';
import postgres from 'postgres';
import { migrationsFolder } from '../migrate';
import {
  withMigratedTestDatabase,
  withTestDatabase,
} from './postgres-test-database';

it('gives each test its own database with every migration applied', async () => {
  const databases = await Effect.runPromise(
    Effect.all(
      ['Englisch', 'Spanisch'].map((courseName) =>
        withMigratedTestDatabase((database) =>
          Effect.promise(async () => {
            const sql = postgres(database.url, { max: 1 });
            try {
              await sql`
                insert into courses (name, target_language)
                values (${courseName}, 'en')
              `;
              const migrations = await sql<Array<{ readonly count: number }>>`
                select count(*)::int as count from drizzle.__drizzle_migrations
              `;
              const courses = await sql<Array<{ readonly name: string }>>`
                select name from courses
              `;
              return {
                migrations: migrations[0]?.count,
                courses: courses.map((course) => course.name),
              };
            } finally {
              await sql.end();
            }
          }),
        ),
      ),
      { concurrency: 'unbounded' },
    ),
  );

  const migrations = readMigrationFiles({ migrationsFolder }).length;
  expect(databases).toEqual([
    { migrations, courses: ['Englisch'] },
    { migrations, courses: ['Spanisch'] },
  ]);
});

it('closes the allocation connection when PostgreSQL rejects database creation', async () => {
  const rootUrl = await Effect.runPromise(Config.String('DATABASE_URL'));
  const applicationName = `wordhold_alloc_${crypto.randomUUID()}`;
  const readOnlyUrl = new URL(rootUrl);
  readOnlyUrl.searchParams.set('application_name', applicationName);
  readOnlyUrl.searchParams.set(
    'options',
    '-c default_transaction_read_only=on',
  );
  const admin = postgres(rootUrl, { max: 1 });

  try {
    const error = await Effect.runPromise(
      withTestDatabase(() => Effect.void).pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              // biome-ignore lint/style/useNamingConvention: Environment variable name.
              DATABASE_URL: readOnlyUrl.toString(),
            }),
          ),
        ),
        Effect.flip,
      ),
    );
    expect(error.message).toBe('Could not create an isolated test database.');
    expect(error.cause).toMatchObject({ code: '25006' });
    const connections = await admin`
      select pid from pg_stat_activity
      where application_name = ${applicationName}
    `;
    expect(connections).toHaveLength(0);
  } finally {
    // Also clean up the original leak when this regression test fails.
    await admin`
      select pg_terminate_backend(pid) from pg_stat_activity
      where application_name = ${applicationName}
    `;
    await admin.end();
  }
});
