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
| `WORDHOLD_PUBLIC_URL` | Public HTTP(S) origin used for authentication callbacks. Production uses `https://wordhold.vornholt.online`; previews use their own origin. |
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

## Production image

The root `Dockerfile` builds the app with TanStack Start's Nitro Bun preset and serves HTTP on `0.0.0.0:3000`. Run `bun run --cwd packages/db db:migrate:production` from the same image before starting a new digest. The command applies the committed Drizzle migrations from `packages/db/drizzle` and exits non-zero when PostgreSQL is unavailable or a migration fails.

`GET /api/health` returns `200` only after a real PostgreSQL query succeeds. It returns `503` when the database is unavailable and always disables response caching. Runtime infrastructure should use this endpoint for readiness after migrations.

## Provider credentials

Both AWS credentials belong to one dedicated IAM user, `WordholdDevelopment`, which has no console password. The SigV4 pair permits only `polly:SynthesizeSpeech`. The Bedrock API key uses the same user's permissions. AWS controls Mantle API-key authentication with `bedrock-mantle:CallWithBearerToken`. Wordhold also needs `bedrock-mantle:CreateInference` on `arn:aws:bedrock-mantle:us-east-1:765727302936:project/default`. The [AWS service authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_bedrock-mantle.html) marks `CreateInference` as project-scoped. This application does not need project listing, tagging, or management permissions.

Rotate the Bedrock API key from the repository root:

```sh
bun run --cwd apps/web provider:rotate-bedrock-key
just dev-env-generate
bun run --cwd apps/web provider:verify
aws iam delete-service-specific-credential \
  --user-name WordholdDevelopment \
  --service-specific-credential-id '<predecessor credential printed above>'
```

The rotation command needs an operator AWS identity that can list, create, and delete Bedrock service-specific credentials for `WordholdDevelopment`. The application SigV4 pair cannot manage its own credentials, and the repository credential broker does not manage AWS IAM users. The command checks that AWS has at most one Bedrock key before creating another. It gives the replacement a 90-day lifetime and passes the one-time `ServiceCredentialSecret` from AWS CLI memory straight to `sops set --value-stdin`. If decoding or storage fails after creation, it revokes the new ID automatically. If cleanup also fails, it prints the new ID and exact revocation command, never the value. `provider:verify` then makes real judge and sentence requests with the generated environment. Delete the explicitly named predecessor only after both requests pass.

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

`/courses/$courseId/import` uploads a page photo to `POST /api/pages`, which stores the image permanently under `WORDHOLD_DATA_DIR/pages/` for provenance and runs vision extraction. A model failure never loses the photo. The page lands in the open-import queue, where extraction can be retried or the photo can be deleted. When the model finds a visible unit heading, `/pages/$pageId/verify` selects the course unit with the same normalized name or prefills a new unit with that name. Without a detected heading, it falls back to the latest real unit. The screen shows the photo next to the editable extracted entries so the assignment can still be corrected. One selection can be applied to the whole page or from one entry onward when a photographed page crosses a unit boundary. A course is a textbook, a unit is a chapter of it, and a page is one photo. A unit usually spans several photos, so a name that already exists resolves to that unit rather than failing. The unit is created in the same transaction as its entries, so a failed import never leaves an empty chapter behind. Importing writes entries, textbook examples, accepted answers in both directions normalized via `src/shared/grading/normalize.ts`, two FSRS cards per entry, and best-effort Polly audio under `WORDHOLD_DATA_DIR/audio/`. A successful import retires the cached overview immediately, so returning there cannot show the imported page as open work again.

Uploads accept JPEG, PNG, and WebP images up to 12 MiB, 12,000 pixels per side, and 40 million pixels total. Wordhold reads the format and dimensions from the file bytes instead of trusting the browser MIME declaration. Each verified page accepts at most 100 entries, and one import can make at most 50 Polly calls. Before new page or audio writes, storage reconciliation removes generated files older than 24 hours only when no page or audio row references them. This clears crash leftovers without touching recent in-flight writes or unrelated files.

## Course page

`/courses/$courseId` is where a course is worked on (`src/features/courses/`). It carries the course totals, actions that apply to the whole course, and the list of its units with how much of each has been learned. Practice appears only when the dashboard's queue counts say the course has an introduced due or fresh card in an enabled direction. `/courses/$courseId/units/$unitId` opens one unit with every vocabulary entry and its translation, marks entries the learning pass has not met yet, and offers the unit's two sittings. Learning appears while the unit still holds unmet entries, drilling once it holds met ones, so a unit nobody has started offers only the learning pass and a finished one offers only the drill. An empty unit offers neither and is not described as learned.

This is deliberately the only unit list. Learning and drilling used to have a picker each, which meant three routes listing the same units and five links on every dashboard card. Both sittings now start from the unit itself, where the learner can see what the sitting will ask about.

## Learning pass

`/courses/$courseId/units/$unitId/learn` walks through the unit's unmet entries one at a time (`src/features/learning/`). The entry is spoken and its German prompt stays on screen. Its translation appears only as the input placeholder, so it disappears when the learner starts typing and must be held in memory for the rest of the answer. Nothing here is graded and nothing reaches the scheduler. The match uses deterministic normalization from `src/shared/grading/normalize.ts` and the bounded textbook-notation parser in `src/shared/grading/variants.ts`. It accepts the prompted spelling and only textbook-authored readings. Manual and judge-written alternatives never count. A wrong copy asks again.

Writing an entry correctly stamps `cards.introduced_at` on both of its cards, one entry at a time, so leaving halfway keeps what was learned. The write must still match the course, unit, and entry loaded for the page. If persistence fails, the page keeps the same entry and offers a retry. `introduced_at` is deliberately separate from the FSRS `state` column. `state` says where a card stands in the scheduler, while `introduced_at` says whether the learner has ever met the entry. Cards without it are excluded from the practice queue and from the dashboard's due and new counts. After deploying the generated column migration, run `bun run --cwd packages/db db:backfill-introductions` to preserve the review time of cards already answered.

## Practice flow

`/courses/$courseId/practice` serves everything due plus a bounded batch of new cards, both restricted to introduced cards (`src/features/practice/services/practice-service.ts`). Grading is hybrid. A normalized deterministic match is instant. Textbook-sourced answers may carry optional words, inline optional affixes, word alternatives, suffix shorthand, or explicit phrase alternatives, such as `to intend (to)`, `étudiant(e)`, `der/die Angestellte`, `amigo/a`, and `die Straße / der Weg`. The bounded parser in `src/shared/grading/variants.ts` expands at most 24 readings. Every reading expressed by the learner must be accepted before deterministic grading bypasses the AI judge. Overflow and unproven readings go to the judge instead of being truncated. Manual and judge-written accepted answers receive normalized literal matching but are not reinterpreted as textbook notation. Judge verdicts are cached per entry, direction, and normalized answer and can write accepted alternatives back. FSRS derives ratings from the outcome. A fast exact answer is Easy, a flawed but accepted answer is Hard, and a rejected answer is Again. The learner never reports a rating. If the judge is unreachable, the card stays untouched. Pronunciation plays via `GET /api/entries/$entryId/audio`.

The session is one loop the learner works to the end (`src/features/practice/services/session-queue.ts`). A missed card goes back into the queue three cards later instead of leaving the session, because FSRS puts it on a one-minute relearning step and the dashboard would otherwise count it as due again moments after the session was closed. Answering a card bumps its revision, so `submit` returns the new one and the repeat is submitted against it rather than being rejected as stale. The progress bar counts distinct cards once they leave the queue, including cards the judge could not grade. A repeat therefore never moves it backwards, and the end never moves away. An ungraded answer leaves the session without changing the card. The final summary counts ungraded cards and says their learning state and existing schedule stayed unchanged instead of claiming the sitting was completed.

## Unit drill

Reviews mix across the whole course, which is what spaced repetition needs and the wrong shape the night before a class test on one unit. `/courses/$courseId/units/$unitId/drill` runs a sitting made only of that unit's learned cards, due or not (`src/features/practice/services/session-store.ts`). It picks a direction the same way the scheduled queue does and runs the same session loop, so a missed card comes back within the drill.

Cramming must not damage the schedule. Every answer is written to `reviews` with `reviews.mode` set to `drill`, so statistics can tell a drilled answer from one the queue asked for. The mode is only provenance. Whether an answer rewrites the card's FSRS schedule is decided from the server-owned card by `src/features/practice/services/schedule-guard.ts`. A card in `review` state that was not due yet keeps its schedule, because writing a fresh interval from a crammed answer would push an entry the learner barely knows three weeks out. A card that was genuinely due counts as a real review. So does a card still on a learning or relearning step, whose steps are minutes apart and exist to be answered again, including the repeat of a card missed moments earlier in the same drill.

When the schedule is held back, the card still claims and increments its revision with compare-and-swap. Its FSRS fields do not change. A duplicate or stale answer therefore cannot write a second review, and a repeat in the same sitting uses the returned revision.

## Direction control

A card is asked one way round: German first (`to_target`) or the foreign-language entry first (`to_native`). Both are chosen twice over.

A sitting picks one. `/courses/$courseId/practice` opens on a picker unless the URL already carries `?direction=`, and the choice only narrows the queue for that sitting (`src/features/practice/services/session-options.ts`). "Gemischt" is offered when there is more than one direction to mix; a course down to a single direction has nothing to pick, so it starts straight away.

A course switches a direction off for good under `/courses/$courseId/settings`, stored in `courses.directions` (`src/features/courses/`). A direction that is off stops being asked, stops being scheduled, and stops being counted on the dashboard, in the practice queue as well as in the due and new figures. Its cards are only hidden: they keep their FSRS schedule, so switching the direction back on picks up where it left off instead of starting those entries over. The last remaining direction cannot be switched off, because a course with none would schedule nothing and offer no screen to switch one back on from.

The stored column is read by unnesting it into one row per direction. The Postgres driver hands an array column back as the raw text `{to_target,to_native}`, so a query returning rows is the only one whose shape this code decides; what comes back is then decoded with a Schema.

## Dashboard

The signed-in start page shows only real data (`src/features/dashboard/services/dashboard-service.ts`): per-course due, new, and vocabulary counts, how many entries still await the learning pass, today's review count in `WORDHOLD_OWNER_TIME_ZONE`, and "Wackelkandidaten" with at least two Again ratings in the last 30 days. A course card answers one question: is there work here today. It carries the counts, the course name as the way into the course page, and "Üben" when an introduced due or fresh card is available in an enabled direction. A course with no entries yet carries the import link inside its own empty sentence instead. Due and new count cards the practice session would actually offer, so they ignore entries that have not been learned yet. The "zu lernen" figure counts entries rather than cards because the learning pass introduces both directions of an entry together.
