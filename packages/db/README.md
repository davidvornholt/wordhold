# @wordhold/db

Drizzle schema, migrations, and the Effect Postgres client for wordhold's
primary database.

## Configuration

| Value | Required | Behavior |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. In development it is composed into `.env.local` by `just dev-env-generate` from `secrets/dev.yaml`; the local container from `just dev-db-start` derives its user, password, database, and port from this URL. No default. |

This package reads no other environment variables. `drizzle.config.ts` is the
CLI environment boundary (`bun --env-file=.env.local drizzle-kit ...`);
runtime access goes through the Effect layers in `src/client.ts`, which read
`DATABASE_URL` via Effect `Config`.

## Migrations

Structure comes from Drizzle Kit only. Never handwrite structural or data statements into its SQL files:

```sh
bun run db:generate   # emit SQL from the schema source of truth
bun run db:migrate    # apply generated structure and registered data migrations
```

`src/migrate.ts` applies generated migrations in journal order and runs registered TypeScript data migrations at their declared boundary. The unit migration is split into generated structural steps around `src/migrations/backfill-units.ts`, which files existing vocabulary before Drizzle makes `entries.unit_id` required. Keep data changes in that code-owned path so regenerating SQL cannot erase them.
