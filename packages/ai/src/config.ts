import { Config } from 'effect';

export const awsRegion = Config.string('AWS_REGION');
export const awsAccessKeyId = Config.redacted('AWS_ACCESS_KEY_ID');
export const awsSecretAccessKey = Config.redacted('AWS_SECRET_ACCESS_KEY');
