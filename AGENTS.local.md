# Project-specific rules

## Verification

- Database-backed tests read `DATABASE_URL` from the environment, and `bun test` does not load `.env.local`. Run them with `bun --env-file=.env.local test <files>` inside `apps/web`, or export `DATABASE_URL` from `apps/web/.env.local` before `bun run check:fix`.
- The accessibility fixtures (`apps/web/a11y`) render feature components without a server: `bunx vite --config a11y/vite.config.ts` in `apps/web`, then `/?state=<fixture>`. Use them for screenshots.
