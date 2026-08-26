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

Structure comes from Drizzle Kit only — never handwritten:

```sh
bun run db:generate   # emit SQL from the schema source of truth
bun run db:migrate    # apply to the database from .env.local
```

A generated file may be extended with data statements when a new required
column has to be filled for rows that already exist. Drizzle Kit emits the
`add column ... not null` that such a column needs, but it cannot know what
the existing rows should say, so applying its output as generated would fail
against any non-empty database. `0004_tearful_energizer.sql` is the worked
example: it adds the column nullable, derives one unit per already-imported
page, gathers orphaned vocabulary under a per-course "Ohne Einheit", and only
then tightens the column and adds the foreign key. Never edit the structural
statements themselves — regenerate them from the schema instead.
