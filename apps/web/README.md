# @wordhold/web

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

Model availability depends on the endpoint and location. Verify the configured models before deploying a provider change.
