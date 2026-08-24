import { PgClient } from '@effect/sql-pg';
import { Config } from 'effect';

// The single Postgres layer shared by every Effect service that touches the
// database. DATABASE_URL is read through Config so the env boundary stays in
// one place.
export const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
});
