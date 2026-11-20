import { Config, Effect, Redacted } from 'effect';
import { migrateDatabase } from '../migrate';

const program = Effect.gen(function* () {
  const databaseUrl = yield* Config.Redacted('DATABASE_URL');
  const timeZone = yield* Config.String('WORDHOLD_OWNER_TIME_ZONE');
  yield* migrateDatabase({ url: Redacted.value(databaseUrl), timeZone });
  yield* Effect.log('Wordhold database migrations are current.');
});

await Effect.runPromise(program);
