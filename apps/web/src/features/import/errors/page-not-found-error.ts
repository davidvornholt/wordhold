import { Data } from 'effect';

// biome-ignore lint/security/noSecrets: this stable Effect tag is not a credential
export class PageNotFoundError extends Data.TaggedError('PageNotFoundError')<{
  readonly message: string;
}> {}
