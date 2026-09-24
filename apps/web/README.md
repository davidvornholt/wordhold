# @wordhold/web

## Production image

The root `Dockerfile` builds the app with TanStack Start's Nitro Bun preset and serves HTTP on `0.0.0.0:3000`. Run `bun run --cwd packages/db db:migrate:production` from the same image before starting a new digest. The command applies the committed Drizzle migrations from `packages/db/drizzle` and exits non-zero when PostgreSQL is unavailable or a migration fails.

`GET /api/health` returns `200` only after a real PostgreSQL query succeeds. It returns `503` when the database is unavailable and always disables response caching. Runtime infrastructure should use this endpoint for readiness after migrations.

## Provider credentials

The AWS SigV4 pair belongs to the dedicated `WordholdDevelopment` IAM user and permits only `polly:SynthesizeSpeech`.

Rotate the Polly SigV4 pair with the same replace, verify, revoke order. Store both replacement values in `secrets/dev.yaml`, run `just dev-env-generate`, verify Polly through the web import flow, then call `aws iam delete-access-key --user-name WordholdDevelopment --access-key-id '<predecessor access key ID>'`. Never put either secret value in a shell argument or terminal output.

`GOOGLE_SERVICE_ACCOUNT_JSON` is the single-line key JSON for the `wordhold-extraction` service account in Google Cloud project `wordhold-a52aa0`, which holds `roles/aiplatform.user` and nothing else. The project has billing enabled and the Vertex AI API turned on. Page extraction, answer checking, example sentences, and translations use it. All requests set high thinking; extraction makes one model call even for low-confidence pages. Rotate by creating a second key with `gcloud iam service-accounts keys create`, writing it into `secrets/dev.yaml` with `just secrets edit dev`, then deleting the old key ID.

Model availability depends on the endpoint and location. Run `bun run --cwd apps/web provider:verify` with the generated environment to verify all three configured model slots before deployment. The check uses a synthetic textbook page and validates extraction, answer checking, sentence generation, and translations.
