import { Config } from 'effect';

export const anthropicApiKey = Config.Redacted('ANTHROPIC_API_KEY');

// Polly and Transcribe read the AWS settings.
export const awsRegion = Config.String('AWS_REGION');
export const awsAccessKeyId = Config.Redacted('AWS_ACCESS_KEY_ID');
export const awsSecretAccessKey = Config.Redacted('AWS_SECRET_ACCESS_KEY');
