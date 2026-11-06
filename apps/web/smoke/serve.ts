import { withMigratedTestDatabase } from '@wordhold/db/testing/postgres-test-database';
import { Effect, Exit } from 'effect';

const { Bun, process } = globalThis;

const serveBuild = (databaseUrl: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      Bun.spawn(['bun', '../.output/server/index.mjs'], {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ['ignore', 'inherit', 'inherit'],
      }),
    ),
    (server) => Effect.promise(() => server.exited),
    (server) =>
      Effect.promise(() => {
        server.kill();
        return server.exited;
      }),
  );

const stop = new AbortController();
process.once('SIGTERM', () => stop.abort());

const exit = await Effect.runPromiseExit(
  withMigratedTestDatabase(({ url }) => serveBuild(url)),
  { signal: stop.signal },
);

if (Exit.isSuccess(exit)) {
  process.exitCode = exit.value;
} else if (!stop.signal.aborted) {
  await Bun.write(Bun.stderr, `${String(exit.cause)}\n`);
  process.exitCode = 1;
}
