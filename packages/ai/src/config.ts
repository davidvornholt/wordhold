import { Config } from 'effect';

// Env-configured slots: every model choice is a config value so slots can be
// re-pointed (or swapped to another provider) without touching service code.
export const awsRegion = Config.string('AWS_REGION');
export const bedrockRegion = Config.string('AWS_BEDROCK_REGION');
export const awsAccessKeyId = Config.redacted('AWS_ACCESS_KEY_ID');
export const awsSecretAccessKey = Config.redacted('AWS_SECRET_ACCESS_KEY');
// Bedrock Mantle takes a bearer token, not the SigV4 pair above. Polly still
// needs the pair, so both live here.
export const bedrockApiKey = Config.redacted('AWS_BEDROCK_API_KEY');

export const judgeModel = Config.string('AI_JUDGE_MODEL');
export const sentenceModel = Config.string('AI_SENTENCE_MODEL');
export const extractionModel = Config.string('AI_EXTRACTION_MODEL');
export const extractionEscalationModel = Config.string(
  'AI_EXTRACTION_ESCALATION_MODEL',
);

export const vertexLocation = Config.string('GOOGLE_VERTEX_LOCATION');
export const googleServiceAccountJson = Config.redacted(
  'GOOGLE_SERVICE_ACCOUNT_JSON',
);
