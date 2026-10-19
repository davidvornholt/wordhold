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

// The review reloads the subject's terms after a refused save, so the
// repeats are marked by the time the learner reads this.
const repeatMessage = (repeated: ReadonlyArray<string>): string => {
  const quoted = repeated.map((term) => `„${term}“`).join(', ');
  return repeated.length === 1
    ? `Inzwischen schon im Fach: ${quoted}. Der Begriff ist jetzt markiert und wird übersprungen.`
    : `Inzwischen schon im Fach: ${quoted}. Die Begriffe sind jetzt markiert und werden übersprungen.`;
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
        message: repeatMessage(repeated),
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
