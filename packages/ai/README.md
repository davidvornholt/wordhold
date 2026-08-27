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

## Why the judge uses Bedrock Mantle

AWS exposes GPT-5.6 Luna on both OpenAI-compatible endpoints. Its [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-luna.html) marks Structured Outputs as unsupported on `bedrock-runtime` and lists Responses on `bedrock-mantle`, but it does not say that Mantle accepts OpenAI's strict `text.format` shape. The judge and sentence generator are configured to test that path. Each request sends a strict JSON Schema, and the application decodes the returned value again with Effect Schema. Do not deploy this provider until `provider:verify` succeeds against both production schemas. Documentation and mocked transport tests do not prove the premise.

Mantle uses `https://bedrock-mantle.{region}.api.aws/openai/v1/responses`, the model ID `openai.gpt-5.6-luna`, and a Bedrock API key. Luna is available there in US regions, so `AWS_BEDROCK_REGION` is separate from the `AWS_REGION` that keeps Polly in Frankfurt. Responses are not stored by Bedrock.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region for Polly. |
| `AWS_BEDROCK_REGION` | Region for Bedrock Mantle (`us-east-1`). |
| `AWS_BEDROCK_API_KEY` | Bedrock API key (`ABSK…`) for the OpenAI-compatible endpoint used by the judge and sentence generation. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SigV4 credentials for Polly. |
| `AI_JUDGE_MODEL` | Bedrock model ID for the answer judge. |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation. |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID used when the primary extraction is unsure. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI region. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON (project is read from `project_id`). |
