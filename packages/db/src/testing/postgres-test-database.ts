import { PgClient } from '@effect/sql-pg';
import { Config, Effect, Redacted } from 'effect';
import postgres from 'postgres';
import { migrateDatabase } from '../migrate';

type TestDatabase = {
  readonly name: string;
  readonly rootUrl: string;
  readonly url: string;
};

const allocate = Effect.gen(function* () {
  const rootUrl = yield* Config.string('DATABASE_URL').pipe(
    Effect.mapError(
      (cause) =>
        new Error('DATABASE_URL is required for PostgreSQL tests.', { cause }),
    ),
  );
  const name = `wordhold_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const url = new URL(rootUrl);
  url.pathname = `/${name}`;
  const admin = postgres(rootUrl, { max: 1 });
  yield* Effect.tryPromise({
    try: () => admin`create database ${admin(name)}`,
    catch: (cause) =>
      new Error('Could not create an isolated test database.', { cause }),
  });
  yield* Effect.promise(() => admin.end());
  return { name, rootUrl, url: url.toString() };
});

const release = (database: TestDatabase) =>
  Effect.acquireUseRelease(
    Effect.sync(() => postgres(database.rootUrl, { max: 1 })),
    (admin) =>
      Effect.promise(() =>
        admin`drop database ${admin(database.name)} with (force)`.then(
          () => undefined,
        ),
      ),
    (admin) => Effect.promise(() => admin.end()),
  );

export const withTestDatabase = <A, E, R>(
  use: (database: TestDatabase) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | Error, R> =>
  Effect.acquireUseRelease(allocate, use, release);

export const withMigratedTestDatabase = <A, E, R>(
  use: (database: TestDatabase) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | Error, R> =>
  withTestDatabase((database) =>
    Effect.zipRight(migrateDatabase(database.url), use(database)),
  );

export const testDatabaseLayer = (url: string) =>
  PgClient.layer({
    url: Redacted.make(url),
    transformQueryNames: (name) =>
      name.replaceAll(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
  });
