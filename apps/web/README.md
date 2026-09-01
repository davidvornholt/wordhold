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

`/courses/$courseId/import` accepts up to ten page photos per batch and processes three pages at a time. `POST /api/pages` stores one image permanently under `WORDHOLD_DATA_DIR/pages/` for provenance and returns its stable page ID before vision extraction starts. The client then calls the authenticated extraction action and reports the storage and extraction stages separately for each photo. A model failure never loses the photo or blocks later photos in the batch. Every stored page records the batch session, its position and the expected batch size. Once the first photo is stored, the batch size is fixed; the capture screen keeps the learner in place until any missing upload is retried or removed before storage. The dashboard therefore shows one resumable stack per upload, reports incomplete processing, and enables review only after every expected page is stored. Discarded sessions are tombstoned so an upload that was already in flight cannot recreate them. `/imports/$sessionId` reconstructs its ordered pages after navigation or reload. The extraction records a printed page number and its confidence when one is visible. Verification sorts the whole stack by those numbers when every photo has a distinct number with at least 0.9 confidence. Otherwise it keeps the original upload order. Only the first unchecked page in that order can start or resume the review, and each successful import opens the next page. The visible back action returns to the stack without changing page state. Validated URL search data records progress through the required sequence, while the persisted session remains the source of truth for the stack itself. When the model finds a visible unit heading, `/pages/$pageId/verify` selects the course unit with the same normalized name or prefills a new unit with that name. Without a detected heading, it falls back to the latest real unit. The screen shows the photo next to the editable extracted entries so the assignment can still be corrected. One selection can be applied to the whole page or from one entry onward when a photographed page crosses a unit boundary. A course is a textbook, a unit is a chapter of it, and a page is one photo. A unit usually spans several photos, so a name that already exists resolves to that unit rather than failing. The unit is created in the same transaction as its entries, so a failed import never leaves an empty chapter behind. Importing writes entries, textbook examples, accepted answers in both directions normalized via `src/shared/grading/normalize.ts`, two FSRS cards per entry, and best-effort Polly audio under `WORDHOLD_DATA_DIR/audio/`. A successful import refreshes both the dashboard and the session stack, so neither can show the imported page as open work again.

Re-scanning a page must not duplicate vocabulary. The verify screen flags every entry whose word already exists in the selected unit, comparing after Unicode normalization and ignoring punctuation, symbols, and extra whitespace. An exact duplicate — same casing and the same example sentence (or none on either side) — is never imported again; the row explains that changing the casing or the example enables an exception. A variant that differs in casing or example sentence is imported only after the learner checks its explicit exception checkbox, and editing the row's text voids that confirmation. The flagging also covers repeats within one page. The server enforces the same rule inside the import transaction behind a per-course advisory lock, so a concurrent or stale verify screen gets a typed `DuplicateEntryError` instead of silently writing duplicates; there is deliberately no database unique index, because exact identity spans the entry text and its example sentences across two tables.

When an extracted entry has no textbook example, the verify screen can request one sentence and its German translation from `AI_SENTENCE_MODEL`. Generation is available only after both sides of the vocabulary pair are present. The learner can edit both generated fields before import, and the stored example keeps `generated` as its source.

Uploads accept JPEG, PNG, and WebP images up to 12 MiB, 12,000 pixels per side, and 40 million pixels total. Wordhold reads the format and dimensions from the file bytes instead of trusting the browser MIME declaration. Each verified page accepts at most 100 entries, and one import can make at most 50 Polly calls. Before new page or audio writes, storage reconciliation removes generated files older than 24 hours only when no page or audio row references them. This clears crash leftovers without touching recent in-flight writes or unrelated files.

## Course page

`/courses/$courseId` carries course totals, the next useful action, importing and settings (`src/features/courses/`). Its unit rows distinguish vocabulary that has not been introduced, first reviews, due reviews and the next scheduled date. `/courses/$courseId/units/$unitId` is the action page for one chapter: it offers kennenlernen while directions remain unintroduced and lets the learner select any vocabulary for a custom practice sitting. An empty unit offers neither action.

The course page also owns manual unit management. Editing mode can append an empty unit and reorder the complete course unit list by drag-and-drop, keyboard dragging, or explicit up and down controls. Every change is persisted immediately. The vocabulary list shows the first stored example inside each entry's expanded details. If an entry has no example, the learner can generate and persist one there without starting a new import.

`/courses/$courseId/vocabulary` is the searchable inventory and schedule view for the whole course. It filters by unit, due cards, first reviews and difficult vocabulary. Every entry starts with one compact status across its enabled directions; expanding it shows each direction's learning state, next date and failure count. Checkboxes can combine any vocabulary across units into one custom practice sitting. "Alle auswählen" includes unintroduced entries instead of silently stopping at the latest 20-card learning section.

## Learning pass

`/courses/$courseId/units/$unitId/learn` walks through the unit's unmet card directions one at a time (`src/features/learning/`). The prompt stays on screen and the answer appears only as the input placeholder, so it disappears when the learner starts typing and must be held in memory for the rest of the answer. The foreign-language side is spoken when audio is available. Nothing here is graded and nothing reaches the scheduler. The match uses deterministic normalization from `src/shared/grading/normalize.ts` and the bounded textbook-notation parser in `src/shared/grading/variants.ts`. It accepts the prompted spelling and only textbook-authored readings, including either complete answer separated by a semicolon. Commas do not affect a match. Known compact slash forms and complete phrase alternatives accept whitespace on either side of `/`. Manual and judge-written alternatives never count. A wrong copy asks again. The answer field starts focused, Enter checks it, and the field regains focus after a failed attempt.

Writing an answer correctly in kennenlernen stamps `cards.introduced_at` on that direction's card, so leaving halfway keeps exactly what was learned. Enabling a second direction later therefore adds it to the learning pass instead of exposing an unseen answer in regular practice. The write must still match the course, unit, and card loaded for the page. If persistence fails, the page keeps the same card and offers a retry. `introduced_at` is deliberately separate from the FSRS `state` column. `state` says where a card stands in the scheduler, while `introduced_at` says whether the learner has ever met that direction. Cards without it are excluded from regular practice and from the dashboard's due and new counts. A selection that contains only unseen vocabulary enters the same ungraded kennenlernen flow. A mixed selection may still introduce an unseen card through its first graded answer. After deploying the generated column migration, run `bun run --cwd packages/db db:backfill-introductions` to preserve the review time of cards already answered.

## Practice flow

`/courses/$courseId/practice` builds the next section from introduced cards in enabled directions (`src/features/practice/services/practice-service.ts`). Due reviews come first. First reviews fill the remaining space up to 20 cards. Missing a date does not reset or punish a card; the overdue card stays due, is labelled with how long it has been overdue and moves to the front of the next section. The dashboard and course pages distinguish due reviews from first reviews, show the exact number ready in the next section and show the next date when nothing is ready.

Grading is hybrid. A normalized deterministic match is instant. Textbook-sourced answers may carry optional words, inline optional affixes, word alternatives, suffix shorthand, or complete answers separated by a semicolon, such as `to intend (to)`, `étudiant(e)`, `der/die Angestellte`, `amigo/a`, `die Straße / der Weg`, and `to view; to look at`. The bounded parser in `src/shared/grading/variants.ts` expands at most 24 readings. Known compact slash forms and complete phrase alternatives accept whitespace on either side of `/`. Inner commas are ignored during comparison. Every reading expressed by the learner must be accepted before deterministic grading bypasses the AI judge. Overflow and unproven readings go to the judge instead of being truncated. Manual and judge-written accepted answers receive normalized literal matching but are not reinterpreted as textbook notation. Judge verdicts are cached per entry, direction and normalized answer and can write accepted alternatives back. FSRS derives ratings from the outcome. A fast exact answer is Easy, a flawed but accepted answer is Hard and a rejected answer is Again. A rejected answer remains pending while its feedback is visible. Continuing confirms Again. The learner can instead correct a typo or bad verdict to Hard without saving the submitted text as an accepted answer. Both choices resolve the exact rejected assessment already shown instead of grading the answer again. If the judge is unreachable, the card stays untouched. Pronunciation plays via `GET /api/entries/$entryId/audio`.

The learner can also choose "Weiß ich nicht" to reveal the expected answer without sending an answer for grading. That review records Again and returns in the after-round without consulting the matcher, judge or cache.

The feedback panel names the result and immediately shows the resulting schedule. A missed card enters FSRS relearning and returns in a named after-round after the current section. It remains in that after-round until answered correctly, without waiting for the persisted FSRS time inside the active sitting. FSRS still owns the next date after the sitting. The progress bar counts distinct cards and never moves backwards. An ungraded answer leaves both learning state and date unchanged.

Large custom selections are divided into 20-card sections without truncating the sitting. Each checkpoint offers another section or a clean stop. The summary separates first-try answers, after-round recoveries and answers the judge could not grade. It also shows the earliest next review and any remaining scheduled backlog.

## Custom practice

Reviews should mix across a course, but a learner may also prepare one unit or a hand-picked set. `/courses/$courseId/study` accepts either a unit or selected vocabulary from any number of units. A selection containing only unseen vocabulary opens kennenlernen, keeps the exact selection and never grades or schedules the copying step. Other selections enter custom practice. They include every selected card whether introduced or due and offer every direction in the selection, even when that direction is disabled for the regular plan. The first stored answer introduces a previously unseen card in a mixed selection.

Custom practice must not inflate intervals. Every answer is stored with its provenance in `reviews.mode`. The server-owned card decides whether FSRS may change its schedule in `src/features/practice/services/schedule-guard.ts`. A correct answer to a future review card keeps the existing date. A wrong answer always starts relearning and brings the date forward, because the failure is evidence that the old plan is no longer safe. Due cards and cards already in learning or relearning advance normally. A held card still claims its revision with compare-and-swap, so duplicate and stale answers cannot be recorded twice.

## Direction control

A card is asked one way round: German first (`to_target`) or the foreign-language entry first (`to_native`). Both are chosen twice over.

A sitting picks one. The start screen shows every available direction as an explicit radio choice with its exact card count. "Gemischt" appears only when there is more than one direction to mix. Wordhold remembers the last choice per course, while still showing it before every start. A course down to a single regular direction starts directly.

A course switches a direction off for good under `/courses/$courseId/settings`, stored in `courses.directions` (`src/features/courses/`). A direction that is off stops being asked, stops being scheduled, and stops being counted on the dashboard, in the practice queue as well as in the due and new figures. Its cards are only hidden: they keep their FSRS schedule, so switching the direction back on picks up where it left off instead of starting those entries over. The last remaining direction cannot be switched off, because a course with none would schedule nothing and offer no screen to switch one back on from.

The stored column is read by unnesting it into one row per direction. The Postgres driver hands an array column back as the raw text `{to_target,to_native}`, so a query returning rows is the only one whose shape this code decides; what comes back is then decoded with a Schema.

## Dashboard

The signed-in start page shows only real data (`src/features/dashboard/services/dashboard-service.ts`): per-course due reviews, first reviews, cards ready in the next 20-card section, vocabulary still to introduce, the next date, enabled-direction count, today's distinct cards and today's answer count. "Wackelkandidaten" lists vocabulary with at least two Again ratings in the last 30 days and links directly to the difficult-vocabulary filter. A course with zero due reviews can still offer practice when first reviews are ready; the separate labels make that reason visible instead of presenting a contradictory "0 fällig" action.
