import { SqlClient } from '@effect/sql';
import { PgClient } from '@effect/sql-pg';
import { Config } from 'effect';

// Application services depend on this tag through @wordhold/db instead of
// reaching through the package boundary to @effect/sql.
export const Database = SqlClient.SqlClient;
export type Database = SqlClient.SqlClient;

const toSnakeCase = (name: string): string =>
  name.replaceAll(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`);

// The single Postgres layer shared by every Effect service that touches the
// database. DATABASE_URL is read through Config so the env boundary stays in
// one place.
export const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
  transformQueryNames: Config.succeed(toSnakeCase),
});
