# @wordhold/web

## Production image

The root `Dockerfile` builds the app with TanStack Start's Nitro Bun preset and serves HTTP on `0.0.0.0:3000`. Run `bun run --cwd packages/db db:migrate:production` from the same image before starting a new digest. The command applies the committed Drizzle migrations from `packages/db/drizzle` and exits non-zero when PostgreSQL is unavailable or a migration fails.

`GET /api/health` returns `200` only after a real PostgreSQL query succeeds. It returns `503` when the database is unavailable and always disables response caching. Runtime infrastructure should use this endpoint for readiness after migrations.

## Provider credentials

All production AI tasks use Claude Sonnet 5.5 through Bedrock's `global.anthropic.claude-sonnet-5-5` inference profile with adaptive thinking and medium effort. The shared provider fixes the model and effort for page extraction, vocabulary and definition grading, definition writing, sentences, and translations. Bedrock instructs the model to return JSON; every answer is decoded with its Effect schema before use. Extraction makes one model call even for low-confidence pages.

`AWS_REGION` selects the Bedrock and Polly endpoint. The AWS SigV4 pair belongs to the dedicated `WordholdDevelopment` IAM user and authenticates both services. The user and its `WordholdAiInference` inline policy have one declarative owner: [personal-infra's AWS AI workspace](https://github.com/davidvornholt/personal-infra/tree/main/infra/opentofu/aws-ai). Use that workspace's reviewed current-main reconciliation for recovery or policy changes. Access keys and bearer credentials remain outside OpenTofu state.

Rotate the AWS SigV4 pair with the replace, verify, revoke order. Store both replacement values in `secrets/dev.yaml`, run `just dev-env-generate`, run `bun run --cwd apps/web provider:verify`, verify Polly through the web import flow, then revoke the predecessor key. Never put either secret value in a shell argument or terminal output. Production secret replacements belong in personal-infra's host SOPS file.

Run `bun run --cwd apps/web provider:verify` with the generated environment before deployment. The check uses a synthetic textbook page and exercises every production AI task with the application's credentials.

`GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_VERTEX_LOCATION` are used only by the model benchmark. They are not production application requirements.
