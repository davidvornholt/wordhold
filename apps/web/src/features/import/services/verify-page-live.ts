import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { ImportDatabaseError } from '../errors/import-database-error';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import { commitVerifiedPage } from './verification-commit';

const databaseFailure = (cause: unknown) =>
  new ImportDatabaseError({
    operation: 'verify page',
    cause,
    message: 'Database operation failed: verify page.',
  });

export const verifyPageLive = (
  sql: Database,
  payload: ImportPayloadData,
  courseId: string,
) => {
  const insertEntries = Effect.gen(function* () {
    const inserted = yield* sql<{
      id: string;
      targetText: string;
    }>`insert into entries ${sql.insert(
      payload.entries.map((entry) => ({
        courseId,
        pageId: payload.pageId,
        type: entry.type,
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        grammar: entry.grammar ?? null,
      })),
    )} returning id, target_text as "targetText"`;
    if (inserted.length !== payload.entries.length) {
      return yield* new ImportInvariantError({
        message: 'Not every verified entry was inserted.',
      });
    }
    const examples = payload.entries.flatMap((entry, index) => {
      const entryId = inserted[index]?.id;
      return entryId === undefined ||
        entry.example === undefined ||
        entry.example === ''
        ? []
        : [
            {
              entryId,
              targetText: entry.example,
              source: 'textbook',
            },
          ];
    });
    if (examples.length > 0) {
      yield* sql`insert into entry_examples ${sql.insert(examples)}`;
    }
    const answers = payload.entries.flatMap((entry, index) => {
      const entryId = inserted[index]?.id;
      return entryId === undefined
        ? []
        : [
            {
              entryId,
              direction: 'to_target',
              text: entry.targetText,
              normalized: normalizeAnswer(entry.targetText),
              source: 'textbook',
            },
            {
              entryId,
              direction: 'to_native',
              text: entry.nativeText,
              normalized: normalizeAnswer(entry.nativeText),
              source: 'textbook',
            },
          ];
    });
    yield* sql`insert into accepted_answers ${sql.insert(answers)} on conflict do nothing`;
    const cardRows = inserted.flatMap((entry) => [
      { entryId: entry.id, direction: 'to_target' },
      { entryId: entry.id, direction: 'to_native' },
    ]);
    yield* sql`insert into cards ${sql.insert(cardRows)}`;
    return inserted;
  });

  return sql
    .withTransaction(
      commitVerifiedPage({
        claimPage: sql<{
          id: string;
        }>`update pages set status = 'verified', label = ${payload.label ?? null}, verified_at = now() where id = ${payload.pageId} and status = 'awaiting_verification' returning id`.pipe(
          Effect.map((claimed) => claimed.length > 0),
        ),
        insertEntries,
      }),
    )
    .pipe(
      Effect.mapError((cause) =>
        cause instanceof PageAlreadyVerifiedError ||
        cause instanceof ImportInvariantError
          ? cause
          : databaseFailure(cause),
      ),
    );
};
