import { Config, Effect, Redacted } from 'effect';
import { migrateDatabase } from '../migrate';

const program = Effect.gen(function* () {
  const databaseUrl = yield* Config.redacted('DATABASE_URL');
  yield* migrateDatabase(Redacted.value(databaseUrl));
  yield* Effect.log('Wordhold database migrations are current.');
});

await Effect.runPromise(program);
