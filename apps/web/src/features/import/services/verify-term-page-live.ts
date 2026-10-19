import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { entryIdentityKey } from '../../../shared/vocabulary/entry-identity';
import {
  insertTerm,
  isTermRepeat,
  selectTerms,
} from '../../../shared/vocabulary/insert-terms';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import { ImportDatabaseError } from '../errors/import-database-error';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import type { TermPayloadData } from '../schemas/term-payload';
import { commitVerifiedPage } from './verification-commit';
import { claimPageForReview } from './verify-page-live';

const databaseFailure = (cause: unknown) =>
  new ImportDatabaseError({
    operation: 'verify term page',
    cause,
    message: 'Database operation failed: verify term page.',
  });

// The review leaves out exact repeats, so one here means another tab or an
// earlier term on the same page saved it first.
const repeatedTerms = (
  stored: ReadonlyArray<string>,
  payload: TermPayloadData,
): ReadonlyArray<string> => {
  const pool = [...stored];
  const repeated = new Map<string, string>();
  for (const { term } of payload.terms) {
    if (isTermRepeat(term, pool)) {
      repeated.set(entryIdentityKey(term), term);
    }
    pool.push(term);
  }
  return [...repeated.values()];
};

export const verifyTermPageLive = (
  sql: Database,
  payload: TermPayloadData,
  courseId: string,
) => {
  const insertTerms = Effect.gen(function* () {
    // The same per-course lock as a typed term and a vocabulary import, so
    // the repeat check sees every term saved before.
    yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
    const repeated = repeatedTerms(
      yield* selectTerms(sql, courseId, null),
      payload,
    );
    if (repeated.length > 0) {
      return yield* new DuplicateEntryError({
        duplicates: repeated,
        message: `Schon eingetragen: ${repeated.map((term) => `„${term}“`).join(', ')}. Lade die Seite neu, um die markierten Begriffe zu prüfen.`,
      });
    }
    return yield* Effect.forEach(
      payload.terms,
      (term) =>
        Effect.gen(function* () {
          const entryId = yield* insertTerm(sql, {
            courseId,
            pageId: payload.pageId,
            term: term.term,
            definition: term.definition,
          });
          if (entryId === undefined) {
            return yield* new ImportInvariantError({
              message: 'Das Fach hat keine Liste für seine Begriffe.',
            });
          }
          return entryId;
        }),
      { concurrency: 1 },
    );
  });

  return sql
    .withTransaction(
      commitVerifiedPage({
        claimPage: claimPageForReview(sql, payload.pageId),
        insertEntries: insertTerms,
      }),
    )
    .pipe(
      Effect.mapError((cause) =>
        cause instanceof PageAlreadyVerifiedError ||
        cause instanceof ImportInvariantError ||
        cause instanceof DuplicateEntryError
          ? cause
          : databaseFailure(cause),
      ),
    );
};
