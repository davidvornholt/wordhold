import type { AiCall, AiCallUsage } from './usage';

const million = 1_000_000;

// USD per million tokens or characters, or per second of audio, for standard
// on-demand requests, excluding contracts and tax. Stored with each request,
// so a later price change does not rewrite past estimates.
export type PriceSnapshot =
  | {
      readonly unit: 'tokens';
      readonly input: number;
      readonly cachedInput: number;
      readonly output: number;
      readonly source: string;
      readonly checkedOn: string;
      readonly basis: string;
    }
  | {
      readonly unit: 'characters';
      readonly characters: number;
      readonly source: string;
      readonly checkedOn: string;
      readonly basis: string;
    }
  | {
      readonly unit: 'audio-seconds';
      readonly audioSeconds: number;
      readonly source: string;
      readonly checkedOn: string;
      readonly basis: string;
    };

export const aiPrice = (
  call: Pick<AiCall, 'provider' | 'model'>,
): PriceSnapshot | undefined => {
  if (
    call.provider === 'bedrock' &&
    call.model === 'global.anthropic.claude-sonnet-5-5'
  ) {
    return {
      unit: 'tokens',
      input: 2,
      cachedInput: 0.2,
      output: 10,
      source: 'https://platform.claude.com/docs/en/about-claude/pricing',
      checkedOn: '2026-10-04',
      basis: 'Bedrock standard global pricing; no prompt cache writes',
    };
  }
  if (call.provider === 'polly' && call.model === 'generative') {
    return {
      unit: 'characters',
      characters: 30,
      source: 'https://aws.amazon.com/polly/pricing/',
      checkedOn: '2026-10-04',
      basis: 'Polly generative voices, beyond the free tier',
    };
  }
  if (call.provider === 'transcribe' && call.model === 'standard') {
    return {
      unit: 'audio-seconds',
      audioSeconds: 0.000_166_7,
      source: 'https://aws.amazon.com/transcribe/pricing/',
      checkedOn: '2026-10-04',
      basis:
        'Transcribe standard streaming in EU (Frankfurt), first tier, beyond the free tier',
    };
  }
  return undefined;
};

// Undefined when the provider did not report what the price is based on.
// Prompt cache writes are never requested, and their price depends on how
// long the cache lives, so a request that reports them has no estimate.
export const estimateUsd = (
  usage: AiCallUsage,
  price: PriceSnapshot,
): number | undefined => {
  if (price.unit === 'characters') {
    return usage.characters === undefined
      ? undefined
      : (usage.characters * price.characters) / million;
  }
  if (price.unit === 'audio-seconds') {
    return usage.audioSeconds === undefined
      ? undefined
      : usage.audioSeconds * price.audioSeconds;
  }
  const { tokens } = usage;
  if (tokens === undefined || tokens.cacheWrite > 0) {
    return undefined;
  }
  return (
    (tokens.input * price.input +
      tokens.cachedInput * price.cachedInput +
      tokens.output * price.output) /
    million
  );
};
