# Compose development environment files, start PostgreSQL, apply every pending migration, then start the app.
dev:
    just dev-env-generate
    just dev-db-start
    bun --cwd packages/db run db:migrate
    bun run dev
