import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { ImportDatabaseError } from '../errors/import-database-error';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { UnitNotFoundError } from '../errors/unit-not-found-error';
import type {
  ImportPayloadData,
  UnitSelectionData,
} from '../schemas/import-payload';
import { sessionLock } from './page-repository-utils';
import {
  importSessionIsComplete,
  orderPagesForReview,
} from './page-review-order';
import { commitVerifiedPage } from './verification-commit';

const databaseFailure = (cause: unknown) =>
  new ImportDatabaseError({
    operation: 'verify page',
    cause,
    message: 'Database operation failed: verify page.',
  });

const claimPageForReview = (sql: Database, pageId: string) =>
  Effect.gen(function* () {
    const pageRows = yield* sql<{
      importSessionId: string;
    }>`select import_session_id as "importSessionId" from pages where id = ${pageId} limit 1`;
    const [page] = pageRows;
    if (page === undefined) {
      return false;
    }
    yield* sessionLock(sql, page.importSessionId);
    const sessionPages = yield* sql<{
      id: string;
      extraction: unknown;
      expectedPageCount: number;
      position: number;
      status: 'awaiting_verification' | 'verified';
    }>`select id, extraction, import_expected_count as "expectedPageCount", import_position as position, status from pages where import_session_id = ${page.importSessionId} order by import_position, id`;
    const ordered = orderPagesForReview(sessionPages);
    const firstPendingPage = ordered.pages.find(
      (sessionPage) => sessionPage.status === 'awaiting_verification',
    );
    if (
      !importSessionIsComplete(sessionPages) ||
      firstPendingPage?.id !== pageId
    ) {
      return false;
    }
    const claimed = yield* sql<{
      id: string;
    }>`update pages set status = 'verified', verified_at = now() where id = ${pageId} and status = 'awaiting_verification' returning id`;
    return claimed.length > 0;
  });

export const verifyPageLive = (
  sql: Database,
  payload: ImportPayloadData,
  courseId: string,
) => {
  const resolveUnit = (unit: UnitSelectionData) =>
    unit.kind === 'new'
      ? sql<{ id: string }>`
          insert into units (course_id, name, position)
          values (
            ${courseId},
            ${unit.name},
            coalesce((select max(position) + 1 from units where course_id = ${courseId}), 0)
          )
          on conflict (course_id, name) do update set name = excluded.name
          returning id
        `.pipe(Effect.map((rows) => rows[0]?.id))
      : sql<{
          id: string;
        }>`select id from units where id = ${unit.unitId} and course_id = ${courseId} limit 1`.pipe(
          Effect.map((rows) => rows[0]?.id),
        );

  const insertEntries = Effect.gen(function* () {
    // All position allocation for one course is serialized inside the
    // transaction. The matching unique index remains the database invariant.
    if (payload.entries.some((entry) => entry.unit.kind === 'new')) {
      yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
    }
    const unitIds = yield* Effect.forEach(
      payload.entries,
      (entry) =>
        Effect.gen(function* () {
          const unitId = yield* resolveUnit(entry.unit);
          if (unitId === undefined) {
            return yield* new UnitNotFoundError({
              message: 'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
            });
          }
          return unitId;
        }),
      { concurrency: 1 },
    );
    const inserted = yield* sql<{
      id: string;
      targetText: string;
    }>`insert into entries ${sql.insert(
      payload.entries.map((entry, index) => ({
        courseId,
        unitId: unitIds[index],
        pageId: payload.pageId,
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
        claimPage: claimPageForReview(sql, payload.pageId),
        insertEntries,
      }),
    )
    .pipe(
      Effect.mapError((cause) =>
        cause instanceof PageAlreadyVerifiedError ||
        cause instanceof ImportInvariantError ||
        cause instanceof UnitNotFoundError
          ? cause
          : databaseFailure(cause),
      ),
    );
};
