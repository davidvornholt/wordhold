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
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI location (`global`). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON for the Google Enterprise AI adapter. |
| `WORDHOLD_DATA_DIR` | Directory for page images and generated audio. Optional. Defaults to `~/.local/share/wordhold`, outside the Git checkout. Set an absolute path for deployment storage. |

## Provider credentials

The AWS pair belongs to a dedicated IAM user, `WordholdDevelopment`, whose inline policy `WordholdAiInference` allows only Bedrock inference on Anthropic Claude models (foundation models plus this account's `eu.anthropic.claude-*` inference profiles) and `polly:SynthesizeSpeech`. It has no console password and no other permissions. Rotate by minting a second access key for that user, writing it into `secrets/dev.yaml` with `just secrets edit dev`, then deleting the old key.

Bedrock model IDs must be exact inference-profile identifiers; `aws bedrock list-inference-profiles --region eu-central-1` prints the valid set. A shortened ID such as `eu.anthropic.claude-haiku-4-5` is rejected at invocation time, not at startup.

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
entries and asks which unit the words belong to — an existing chapter of the
course, or a new one named here. A course is a textbook, a unit is a chapter
of it, and a page is one photo; a unit usually spans several photos, so a
name that already exists resolves to that unit rather than failing. The unit
is created in the same transaction as its entries, so a failed import never
leaves an empty chapter behind. Importing writes entries, textbook examples,
accepted answers (both directions, normalized via
`src/shared/grading/normalize.ts`), two FSRS
cards per entry, and best-effort Polly audio under
`WORDHOLD_DATA_DIR/audio/`.

Uploads accept JPEG, PNG, and WebP images up to 12 MiB, 12,000 pixels per side, and 40 million pixels total. Wordhold reads the format and dimensions from the file bytes instead of trusting the browser MIME declaration. Each verified page accepts at most 100 entries, and one import can make at most 50 Polly calls. Before new page or audio writes, storage reconciliation removes generated files older than 24 hours only when no page or audio row references them. This clears crash leftovers without touching recent in-flight writes or unrelated files.

## Learning pass

`/courses/$courseId/learn` lists the course's units with how many of their words have never been met, and `/courses/$courseId/units/$unitId/learn` walks through those words one at a time (`src/features/learning/`). The word is spoken, its German and its translation are both on screen, and the learner copies it. Nothing here is graded and nothing reaches the scheduler. Copying a word you can see says nothing about whether you will remember it tomorrow, so the match uses deterministic normalization from `src/shared/grading/normalize.ts` and the bounded textbook-notation parser in `src/shared/grading/variants.ts`. It accepts the displayed spelling and only textbook-authored readings. Manual and judge-written alternatives never count. A wrong copy asks again.

Writing a word correctly stamps `cards.introduced_at` on both of its cards, one word at a time, so leaving halfway keeps what was learned. The write must still match the course, unit, and word loaded for the page. If persistence fails, the page keeps the same word and offers a retry. `introduced_at` is deliberately separate from the FSRS `state` column. `state` says where a card stands in the scheduler, while `introduced_at` says whether the learner has ever met the word. Cards without it are excluded from the practice queue and from the dashboard's due and new counts. After deploying the generated column migration, run `bun run --cwd packages/db db:backfill-introductions` to preserve the review time of cards already answered.

## Practice flow

`/courses/$courseId/practice` serves everything due plus a bounded batch of new cards, both restricted to introduced cards (`src/features/practice/services/practice-service.ts`). Grading is hybrid. A normalized deterministic match is instant. Textbook-sourced answers may carry optional words, inline optional affixes, word alternatives, suffix shorthand, or explicit phrase alternatives, such as `to intend (to)`, `étudiant(e)`, `der/die Angestellte`, `amigo/a`, and `die Straße / der Weg`. The bounded parser in `src/shared/grading/variants.ts` expands at most 24 readings. Every reading expressed by the learner must be accepted before deterministic grading bypasses the AI judge. Overflow and unproven readings go to the judge instead of being truncated. Manual and judge-written accepted answers receive normalized literal matching but are not reinterpreted as textbook notation. Judge verdicts are cached per entry, direction, and normalized answer and can write accepted alternatives back. FSRS derives ratings from the outcome. A fast exact answer is Easy, a flawed but accepted answer is Hard, and a rejected answer is Again. The learner never reports a rating. If the judge is unreachable, the card stays untouched. Pronunciation plays via `GET /api/entries/$entryId/audio`.

The session is one loop the learner works to the end (`src/features/practice/services/session-queue.ts`). A missed card goes back into the queue three cards later instead of leaving the session, because FSRS puts it on a one-minute relearning step and the dashboard would otherwise count it as due again moments after the session was closed. Answering a card bumps its revision, so `submit` returns the new one and the repeat is submitted against it rather than being rejected as stale. The progress bar counts distinct cards settled out of the cards the session started with, so a repeat never moves it backwards and the end never moves away. An answer the judge could not grade leaves the session without changing the card. The final summary names every ungraded card and warns that it remains due instead of claiming the sitting was completed.

## Dashboard

The signed-in start page shows only real data (`src/features/dashboard/services/dashboard-service.ts`): per-course due/new/word counts, how many words still await the learning pass, today's review count in `WORDHOLD_OWNER_TIME_ZONE`, and "Wackelkandidaten" with at least two Again-ratings in the last 30 days. Due and new count cards the practice session would actually offer, so they ignore words that have not been learned yet; the "zu lernen" figure counts words rather than cards, because the learning pass introduces both directions of a word together.
