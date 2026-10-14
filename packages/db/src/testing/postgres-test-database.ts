import { PgClient } from '@effect/sql-pg';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Config, Effect, Option, Redacted } from 'effect';
import postgres from 'postgres';
import { migrateDatabase, migrationsFolder } from '../migrate';

type TestDatabase = {
  readonly name: string;
  readonly rootUrl: string;
  readonly url: string;
};

type Admin = postgres.Sql;

const templateHashLength = 16;
const insufficientPrivilegeCode = '42501';

const databaseUrl = (rootUrl: string, name: string) => {
  const url = new URL(rootUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

const attempt = <A>(message: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new Error(message, { cause }),
  });

const withAdmin = <A, E>(
  rootUrl: string,
  use: (admin: Admin) => Effect.Effect<A, E>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => postgres(rootUrl, { max: 1, onnotice: () => undefined })),
    use,
    (admin) => Effect.promise(() => admin.end()),
  );

// The migration files and the code-owned repairs in migrate.ts decide what a
// migrated database contains, so both name its template. Changing either
// builds a new template instead of cloning a stale one.
const migratedTemplateName = Effect.runSync(
  Effect.cached(
    Effect.gen(function* () {
      const migrations = yield* Effect.try({
        try: () => readMigrationFiles({ migrationsFolder }),
        catch: (cause) =>
          new Error('Could not read the Wordhold migrations.', { cause }),
      });
      const repairs = yield* attempt('Could not read migrate.ts.', () =>
        globalThis.Bun.file(new URL('../migrate.ts', import.meta.url)).text(),
      );
      const hasher = new globalThis.Bun.CryptoHasher('sha256');
      for (const migration of migrations) {
        hasher.update(`${migration.folderMillis}:${migration.hash}\n`);
      }
      hasher.update(repairs);
      const hash = hasher.digest('hex').slice(0, templateHashLength);
      return `wordhold_test_template_${hash}`;
    }),
  ),
);

const templateExists = (admin: Admin, template: string) =>
  attempt(
    'Could not look up the migrated test template.',
    () => admin`select 1 from pg_database where datname = ${template}`,
  ).pipe(Effect.map((rows) => rows.length > 0));

// Builds under a working name and publishes by renaming, so a run killed
// mid-build never leaves a half-migrated database under the template name.
const buildTemplate = (admin: Admin, rootUrl: string, template: string) => {
  const building = `${template}_building`;
  return Effect.gen(function* () {
    // Only the holder of the template lock builds, so a database under the
    // working name is a leftover from a builder that died.
    yield* attempt(
      'Could not remove an abandoned test template build.',
      () => admin`drop database if exists ${admin(building)} with (force)`,
    );
    yield* attempt(
      'Could not create the migrated test template.',
      () => admin`create database ${admin(building)}`,
    );
    yield* migrateDatabase(databaseUrl(rootUrl, building)).pipe(
      Effect.mapError(
        (cause) => new Error('Could not migrate the test template.', { cause }),
      ),
    );
    // PostgreSQL refuses to clone a database while anyone is connected to it.
    yield* attempt(
      'Could not close the test template to connections.',
      () =>
        admin`alter database ${admin(building)} with allow_connections false`,
    );
    yield* attempt(
      'Could not publish the migrated test template.',
      () =>
        admin`alter database ${admin(building)} rename to ${admin(template)}`,
    );
    // Every DROP DATABASE forces a checkpoint, which would otherwise sync
    // every template file inside the timeout of whichever test drops next.
    // Without the privilege, that later checkpoint still does the work.
    yield* attempt('Could not flush the migrated test template.', () =>
      admin`checkpoint`.catch((cause: unknown) => {
        if (
          !(cause instanceof postgres.PostgresError) ||
          cause.code !== insufficientPrivilegeCode
        ) {
          throw cause;
        }
      }),
    );
  });
};

// Advisory locks belong to the connected database, while database names are
// cluster-wide. Include that database OID so different roots cannot replace
// each other's active builds. PostgreSQL releases the lock if its holder dies.
const ensureMigratedTemplate = (admin: Admin, rootUrl: string) =>
  Effect.gen(function* () {
    const [{ oid }] = yield* attempt(
      'Could not identify the test root database.',
      () => admin<[{ readonly oid: string }]>`
        select oid::text from pg_database where datname = current_database()
      `,
    );
    const template = `${yield* migratedTemplateName}_${oid}`;
    if (yield* templateExists(admin, template)) {
      return template;
    }
    yield* Effect.acquireUseRelease(
      attempt(
        'Could not lock the migrated test template.',
        () => admin`select pg_advisory_lock(hashtextextended(${template}, 0))`,
      ),
      () =>
        Effect.gen(function* () {
          if (!(yield* templateExists(admin, template))) {
            yield* buildTemplate(admin, rootUrl, template);
          }
        }),
      () =>
        Effect.promise(
          () =>
            admin`select pg_advisory_unlock(hashtextextended(${template}, 0))`,
        ),
    );
    return template;
  });

const rootDatabaseUrl = Config.String('DATABASE_URL').pipe(
  Effect.mapError(
    (cause) =>
      new Error('DATABASE_URL is required for PostgreSQL tests.', { cause }),
  ),
);

const allocate = <E>(
  create: (
    admin: Admin,
    rootUrl: string,
    name: string,
  ) => Effect.Effect<unknown, E>,
) =>
  Effect.gen(function* () {
    const rootUrl = yield* rootDatabaseUrl;
    const name = `wordhold_test_${crypto.randomUUID().replaceAll('-', '')}`;
    yield* withAdmin(rootUrl, (admin) => create(admin, rootUrl, name));
    return { name, rootUrl, url: databaseUrl(rootUrl, name) };
  });

const createEmpty = (admin: Admin, _rootUrl: string, name: string) =>
  attempt(
    'Could not create an isolated test database.',
    () => admin`create database ${admin(name)}`,
  );

const createMigrated = (admin: Admin, rootUrl: string, name: string) =>
  Effect.flatMap(ensureMigratedTemplate(admin, rootUrl), (template) =>
    attempt(
      'Could not create an isolated test database.',
      () => admin`create database ${admin(name)} template ${admin(template)}`,
    ),
  );

const release = (database: TestDatabase) =>
  withAdmin(database.rootUrl, (admin) =>
    Effect.promise(() =>
      admin`drop database ${admin(database.name)} with (force)`.then(
        () => undefined,
      ),
    ),
  );

export const withTestDatabase = <A, E, R>(
  use: (database: TestDatabase) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | Error, R> =>
  Effect.acquireUseRelease(allocate(createEmpty), use, release);

// Clones a template that holds every migration, so each test gets a fresh
// migrated database without replaying the migrations.
export const withMigratedTestDatabase = <A, E, R>(
  use: (database: TestDatabase) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | Error, R> =>
  Effect.acquireUseRelease(allocate(createMigrated), use, release);

// Builds the migrated template ahead of the tests when a database is
// configured. postgres-test-preload.ts runs this before any test file.
export const prepareMigratedTestDatabases = Effect.gen(function* () {
  const configured = yield* Config.option(Config.String('DATABASE_URL'));
  if (Option.isNone(configured)) {
    return;
  }
  yield* withAdmin(configured.value, (admin) =>
    ensureMigratedTemplate(admin, configured.value),
  );
});

export const testDatabaseLayer = (url: string) =>
  PgClient.layer({
    url: Redacted.make(url),
    transformQueryNames: (name) =>
      name.replaceAll(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
  });
