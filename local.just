# Compose development environment files, start PostgreSQL, apply every pending migration, then start the app.
dev:
    just dev-env-generate
    just dev-db-start
    bun run --cwd packages/db db:migrate
    bun run dev
