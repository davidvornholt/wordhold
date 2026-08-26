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
| `AWS_REGION` | AWS region for Polly (`eu-central-1`). |
| `AWS_BEDROCK_REGION` | AWS region for Bedrock Mantle (`us-east-1`). |
| `AWS_BEDROCK_API_KEY` | Bedrock API key (`ABSK…`) for the OpenAI-compatible endpoint used by the judge and sentence generation. |
| `AWS_ACCESS_KEY_ID` | SigV4 credentials for Polly (TTS). |
| `AWS_SECRET_ACCESS_KEY` | Secret half of the SigV4 credentials. |
| `AI_JUDGE_MODEL` | Bedrock model ID for answer judging. |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation. |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID for extraction escalation on low-confidence pages. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI location (`global`). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON for the Google Enterprise AI adapter. |
| `WORDHOLD_DATA_DIR` | Directory for page images and generated audio. Optional. Defaults to `~/.local/share/wordhold`, outside the Git checkout. Set an absolute path for deployment storage. |

## Provider credentials

Both AWS credentials belong to one dedicated IAM user, `WordholdDevelopment`, which has no console password. The SigV4 pair permits only `polly:SynthesizeSpeech`. The Bedrock API key uses the same user's permissions. Mantle requires `bedrock-mantle:CallWithBearerToken`, `bedrock-mantle:CreateInference`, `bedrock-mantle:GetProject`, `bedrock-mantle:ListProjects`, and `bedrock-mantle:ListTagsForResources`. The [AWS permission reference](https://docs.aws.amazon.com/bedrock/latest/userguide/inference.html) documents that set.

Rotate the Bedrock API key from the repository root:

```sh
bun run --cwd apps/web provider:rotate-bedrock-key
just dev-env-generate
bun run --cwd apps/web provider:verify
aws iam delete-service-specific-credential \
  --user-name WordholdDevelopment \
  --service-specific-credential-id '<predecessor credential printed above>'
```

The rotation command checks that AWS has at most one Bedrock key before creating another. It gives the replacement a 90-day lifetime and passes its one-time value from AWS CLI memory straight to `sops set --value-stdin`. The value never enters command arguments, terminal output, a pager, or a plaintext file. It prints the replacement and predecessor IDs only. `provider:verify` then makes real judge and sentence requests with the generated environment. Delete the explicitly named predecessor only after both requests pass.

Rotate the Polly SigV4 pair with the same replace, verify, revoke order. Store both replacement values in `secrets/dev.yaml`, run `just dev-env-generate`, verify Polly through the web import flow, then call `aws iam delete-access-key --user-name WordholdDevelopment --access-key-id '<predecessor access key ID>'`. Never put either secret value in a shell argument or terminal output.

Bedrock model IDs depend on the endpoint. Mantle uses `openai.gpt-5.6-luna`; `global.openai.gpt-5.6-luna` is a different inference-profile ID for `bedrock-runtime` and is rejected by Mantle.

`GOOGLE_SERVICE_ACCOUNT_JSON` is the single-line key JSON for the `wordhold-extraction` service account in Google Cloud project `wordhold-a52aa0`, which holds `roles/aiplatform.user` and nothing else. The project has billing enabled and the Vertex AI API turned on. Page extraction is the only feature that uses it. Rotate by creating a second key with `gcloud iam service-accounts keys create`, writing it into `secrets/dev.yaml` with `just secrets edit dev`, then deleting the old key ID.

Google model availability is per location, so `AI_EXTRACTION_MODEL` and `AI_EXTRACTION_ESCALATION_MODEL` are only valid together with `GOOGLE_VERTEX_LOCATION`. Gemini 3.x is served by the `global` endpoint; single regions such as `europe-west4` stop at the 2.5 generation, and Google's EU data-residency endpoint (`eu`) serves flash models only, no pro-class model. An ID that is wrong for the location fails at invocation with a 404, not at startup. Check one before configuring it:

```sh
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H 'Content-Type: application/json' \
  "https://aiplatform.googleapis.com/v1/projects/wordhold-a52aa0/locations/global/publishers/google/models/gemini-3.7-flash:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"ping"}]}]}'
```

## Auth

The dev server binds port 3000 with `strictPort`, because the GitHub OAuth app's callback URL names that port. If another project holds 3000, the dev server refuses to start rather than serving where sign-in would silently redirect elsewhere.

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
new cards (`src/features/practice/services/practice-service.ts`). Grading is hybrid: a
normalized deterministic match is instant; only mismatches reach the AI
judge, whose verdicts are cached per (entry, direction, normalized answer)
and can write accepted alternatives back. FSRS ratings are derived from the
outcome (fast exact = Easy, flawed-but-accepted = Hard, rejected = Again) —
never self-reported. If the judge is unreachable the card is left
untouched. Pronunciation plays via `GET /api/entries/$entryId/audio`.

## Dashboard

The signed-in start page shows only real data (`src/features/dashboard/services/dashboard-service.ts`): per-course due/new/word counts, today's review count in `WORDHOLD_OWNER_TIME_ZONE`, and "Wackelkandidaten" with at least two Again-ratings in the last 30 days.
