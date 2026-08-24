import { Data } from 'effect';

// biome-ignore lint/security/noSecrets: this stable Effect tag is not a credential
export class MediaNotFoundError extends Data.TaggedError('MediaNotFoundError')<{
  readonly message: string;
}> {}
