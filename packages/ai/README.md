# @wordhold/ai

Effect services wrapping the Vercel AI SDK and Amazon Polly. Every model
choice is an env-configured slot, so models can be re-pointed without code
changes.

| Service | Provider slot | Purpose |
| --- | --- | --- |
| `Extraction` | Google Enterprise AI (`AI_EXTRACTION_MODEL`, escalating to `AI_EXTRACTION_ESCALATION_MODEL` on low confidence) | Vision extraction of textbook vocabulary pages into structured entries. |
| `Judge` | Bedrock OpenAI-compatible endpoint (`AI_JUDGE_MODEL`) | Multi-dimensional grading of answers that failed deterministic matching. |
| `SentenceGen` | Bedrock OpenAI-compatible endpoint (`AI_SENTENCE_MODEL`) | Example-sentence generation for entries. |
| `Tts` | Amazon Polly (neural voices) | Pronunciation audio, batch-generated at import time. |

Structured outputs are validated with Effect Schema via the Standard Schema
bridge (`Schema.standardSchemaV1`), so the AI SDK retries on shape mismatch
and the app only ever sees decoded values.

## Why the judge does not use Bedrock's native API

Bedrock exposes the same models two ways, and the difference decides whether
structured output can be trusted. Its native API passes the JSON schema to
the model as an instruction and hopes for the best, so the model can emit a
character that terminates its own JSON early. German quotation marks did
exactly that: the truncated remainder still parsed as valid JSON, so the
learner silently got half a sentence of feedback with no error anywhere.

The OpenAI-compatible endpoint at
`https://bedrock-runtime.{region}.amazonaws.com/openai/v1` constrains
decoding against the schema, so malformed JSON is not a reachable output.
Two things follow from using it:

- It authenticates with a Bedrock API key (`AWS_BEDROCK_API_KEY`), not the
  SigV4 pair. Polly still uses the pair, so both are configured.
- It serves Chat Completions only. Requests to `/openai/v1/responses` are
  rejected with a misleading 401 about `bedrock:CallWithBearerToken`, so the
  provider is pinned to `.chat()` rather than the AI SDK's Responses default.

`global.openai.gpt-5.6-luna` is the model both slots point at. OpenAI models
on Bedrock have no EU inference profile, so the global profile is the only
one reachable from `eu-central-1`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region for Bedrock and Polly. |
| `AWS_BEDROCK_API_KEY` | Bedrock API key (`ABSK…`) for the OpenAI-compatible endpoint used by the judge and sentence generation. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SigV4 credentials for Polly. |
| `AI_JUDGE_MODEL` | Bedrock model ID for the answer judge. |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation. |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID used when the primary extraction is unsure. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI region. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON (project is read from `project_id`). |
