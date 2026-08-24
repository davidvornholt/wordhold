# @wordhold/web

The Wordhold web app: a TanStack Start application serving both desktop and
phone. It hosts the import flow (photo → extraction → verification), the
practice flow (FSRS scheduling with hybrid grading), and the dashboard.

## Development

```sh
just dev-env-generate   # compose .env.local from config/ + secrets/
just dev-db-start       # start the dev Postgres container
bun run dev             # vite dev server on http://localhost:3000
```

## Configuration

All values are composed into `.env.local` by `just dev-env-generate` from
`config/dev.yaml` (plain), `secrets/dev.yaml` (SOPS-encrypted), and
`config/dev.local.yaml` (gitignored). Application code reads them only
through `src/shared/env/server.ts`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string for the app database. |
| `AUTH_SECRET` | better-auth signing secret (64 hex chars). |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `GITHUB_ALLOWED_USER_ID` | Numeric GitHub user ID of the single allowed user; all other sign-ins are rejected at session creation. |
| `AWS_REGION` | AWS region for Bedrock and Polly (`eu-central-1`). |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Bedrock (judge, sentence generation) and Polly (TTS). |
| `AWS_SECRET_ACCESS_KEY` | Secret half of the AWS credentials. |
| `AI_JUDGE_MODEL` | Bedrock model ID for answer judging (fast Claude). |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation (frontier Claude). |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID for extraction escalation on low-confidence pages. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI region (`europe-west4`). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON for the Google Enterprise AI adapter. |
| `WORDHOLD_DATA_DIR` | Directory for page images and generated audio (optional, defaults to `data`, relative to the server working directory). |

## Auth

GitHub OAuth via better-auth (`src/shared/auth/server.ts`), handled at
`/api/auth/$`. This is a single-user instance: only the GitHub account whose
ID matches `GITHUB_ALLOWED_USER_ID` ever receives a session.

## Import flow

`/courses/$courseId/import` uploads a page photo to `POST /api/pages`, which
stores the image permanently under `WORDHOLD_DATA_DIR/pages/` (provenance)
and runs vision extraction; a model failure never loses the photo — the page
lands in the "awaiting verification" queue and extraction can be retried.
`/pages/$pageId/verify` shows the photo next to the editable extracted
entries; importing writes entries, textbook examples, accepted answers (both
directions, normalized via `src/shared/grading/normalize.ts`), two FSRS
cards per entry, and best-effort Polly audio under
`WORDHOLD_DATA_DIR/audio/`.
