import { expect, it } from 'bun:test';
import { Config, ConfigProvider, Effect } from 'effect';
import postgres from 'postgres';
import { withTestDatabase } from './postgres-test-database';

it('closes the allocation connection when PostgreSQL rejects database creation', async () => {
  const rootUrl = await Effect.runPromise(Config.string('DATABASE_URL'));
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
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([['DATABASE_URL', readOnlyUrl.toString()]]),
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
