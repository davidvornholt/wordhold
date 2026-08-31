import { Data } from 'effect';

// The verify screen flags duplicates before submit; this error is the
// race-safe backstop when the screen's data was stale — for example when a
// concurrent import saved the same word after the page loaded.
export class DuplicateEntryError extends Data.TaggedError(
  'DuplicateEntryError',
)<{
  readonly message: string;
  readonly duplicates: ReadonlyArray<string>;
}> {}
