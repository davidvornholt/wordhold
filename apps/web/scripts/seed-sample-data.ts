import { PgLive } from '@wordhold/db/client';
import { Effect } from 'effect';
import { seedSampleData } from '../src/features/sample-data/services/sample-data-seed';
import { serverEnv } from '../src/shared/env/server';

// Fills a pull request preview's empty database with made-up data. It needs
// DATABASE_URL and WORDHOLD_OWNER_TIME_ZONE and leaves a database with app
// data untouched.
const result = await Effect.runPromise(
  seedSampleData({
    now: new Date(),
    timeZone: serverEnv.ownerTimeZone(),
  }).pipe(Effect.provide(PgLive), Effect.result),
);
if (result._tag === 'Failure') {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    `${result.failure.message}\n${String(result.failure.cause)}\n`,
  );
  // biome-ignore lint/correctness/noProcessGlobal: CLI failure must reach the shell.
  globalThis.process.exitCode = 1;
} else if (result.success.kind === 'skipped') {
  await globalThis.Bun.write(
    globalThis.Bun.stdout,
    'The database already holds data, so no sample data was added.\n',
  );
} else {
  const { people, courses, entries, answers } = result.success;
  await globalThis.Bun.write(
    globalThis.Bun.stdout,
    `Added sample data: ${people} people, ${courses} courses, ${entries} entries and ${answers} answers.\n`,
  );
}
