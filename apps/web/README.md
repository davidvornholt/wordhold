# @wordhold/web

The Wordhold web app: a TanStack Start application serving both desktop and
phone. It hosts the import flow (photo → extraction → verification), the
practice flow (FSRS scheduling with hybrid grading), and the dashboard.

## Development

```sh
just dev
```

`just dev` composes every `.env.local`, starts the local PostgreSQL container, runs `bun --cwd packages/db run db:migrate`, and starts the Vite server at `http://localhost:3000`. The migration step finishes successfully before the app process starts, so a fresh checkout never serves against an empty schema.

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
| `GITHUB_ALLOWED_USER_ID` | Numeric GitHub user ID of the single allowed user. Wordhold rejects other profiles before persistence and rechecks existing sessions against the current value. |
| `WORDHOLD_OWNER_TIME_ZONE` | Required IANA time zone for owner-local day boundaries, such as `Europe/Berlin`. |
| `AWS_REGION` | AWS region for Bedrock and Polly (`eu-central-1`). |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Bedrock (judge, sentence generation) and Polly (TTS). |
| `AWS_SECRET_ACCESS_KEY` | Secret half of the AWS credentials. |
| `AI_JUDGE_MODEL` | Bedrock model ID for answer judging (fast Claude). |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation (frontier Claude). |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID for extraction escalation on low-confidence pages. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI region (`europe-west4`). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON for the Google Enterprise AI adapter. |
| `WORDHOLD_DATA_DIR` | Directory for page images and generated audio. Optional. Defaults to `~/.local/share/wordhold`, outside the Git checkout. Set an absolute path for deployment storage. |

## Auth

GitHub OAuth via better-auth (`src/shared/auth/server.ts`) is handled at `/api/auth/$`. This is a single-user instance. Only the GitHub account whose ID matches `GITHUB_ALLOWED_USER_ID` can be persisted or receive a session. Wordhold rechecks the linked GitHub account on each session use, so changing the allowlist signs out the former owner.

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

Uploads accept JPEG, PNG, and WebP images up to 12 MiB, 12,000 pixels per side, and 40 million pixels total. Wordhold reads the format and dimensions from the file bytes instead of trusting the browser MIME declaration. Each verified page accepts at most 100 entries, and one import can make at most 50 Polly calls. Before new page or audio writes, storage reconciliation removes generated files older than 24 hours only when no page or audio row references them. This clears crash leftovers without touching recent in-flight writes or unrelated files.

## Practice flow

`/courses/$courseId/practice` serves everything due plus a bounded batch of
new cards (`src/shared/practice/session-fn.ts`). Grading is hybrid: a
normalized deterministic match is instant; only mismatches reach the AI
judge, whose verdicts are cached per (entry, direction, normalized answer)
and can write accepted alternatives back. FSRS ratings are derived from the
outcome (fast exact = Easy, flawed-but-accepted = Hard, rejected = Again) —
never self-reported. If the judge is unreachable the card is left
untouched. Pronunciation plays via `GET /api/entries/$entryId/audio`.

## Dashboard

The signed-in start page shows only real data (`src/shared/dashboard/stats-fn.ts`): per-course due/new/word counts, today's review count in `WORDHOLD_OWNER_TIME_ZONE`, and "Wackelkandidaten" with at least two Again-ratings in the last 30 days.
