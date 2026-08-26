# @wordhold/db

Drizzle schema, migrations, and the Effect Postgres client for wordhold's primary database.

## Configuration

| Value | Required | Behavior |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. In development it is composed into `.env.local` by `just dev-env-generate` from `secrets/dev.yaml`; the local container from `just dev-db-start` derives its user, password, database, and port from this URL. No default. |

This package reads no other environment variables. `drizzle.config.ts` is the CLI environment boundary (`bun --env-file=.env.local drizzle-kit ...`); runtime access goes through the Effect layers in `src/client.ts`, which read `DATABASE_URL` via Effect `Config`.

## Migrations

Structure comes from Drizzle Kit only. Never handwrite structural or data statements into its SQL files:

```sh
bun run db:generate   # emit SQL from the schema source of truth
bun run db:migrate    # apply generated structure
```

The unit rollout has two deployable phases so existing vocabulary remains readable while it is filed. Phase one applied the nullable `entries.unit_id` column and the composite course/unit integrity constraint, then new imports began writing a unit.

After phase one is deployed, run `bun run db:backfill-units` once in each deployed database. This code-owned command preserves page provenance, files page-backed vocabulary into real units, files vocabulary without a page into explicit holding units, and fails through its typed Effect error channel if it finds cross-course ownership or cannot prove completion.

Before deploying phase two, run `SELECT count(*) FROM entries WHERE unit_id IS NULL;` in every deployed database and record that it returns exactly `0`. The generated phase-two migration makes `entries.unit_id` required and PostgreSQL refuses to apply it while any legacy row remains unfiled.
