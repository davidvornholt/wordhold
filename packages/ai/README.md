# @wordhold/ai

Effect services wrapping the Vercel AI SDK and Amazon Polly. Every model
choice is an env-configured slot, so models can be re-pointed without code
changes.

| Service | Provider slot | Purpose |
| --- | --- | --- |
| `Extraction` | Google Enterprise AI (`AI_EXTRACTION_MODEL`, escalating to `AI_EXTRACTION_ESCALATION_MODEL` on low confidence) | Vision extraction of textbook vocabulary pages into structured entries. |
| `Judge` | Bedrock (`AI_JUDGE_MODEL`) | Multi-dimensional grading of answers that failed deterministic matching. |
| `SentenceGen` | Bedrock (`AI_SENTENCE_MODEL`) | Example-sentence generation for entries. |
| `Tts` | Amazon Polly (neural voices) | Pronunciation audio, batch-generated at import time. |

Structured outputs are validated with Effect Schema via the Standard Schema
bridge (`Schema.standardSchemaV1`), so the AI SDK retries on shape mismatch
and the app only ever sees decoded values.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region for Bedrock and Polly. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials. |
| `AI_JUDGE_MODEL` | Bedrock model ID for the answer judge. |
| `AI_SENTENCE_MODEL` | Bedrock model ID for sentence generation. |
| `AI_EXTRACTION_MODEL` | Google model ID for page extraction. |
| `AI_EXTRACTION_ESCALATION_MODEL` | Google model ID used when the primary extraction is unsure. |
| `GOOGLE_VERTEX_LOCATION` | Google Enterprise AI region. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account key JSON (project is read from `project_id`). |
