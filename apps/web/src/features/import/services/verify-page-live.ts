import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import { ImportDatabaseError } from '../errors/import-database-error';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { UnitNotFoundError } from '../errors/unit-not-found-error';
import type {
  ImportPayloadData,
  UnitSelectionData,
} from '../schemas/import-payload';
import { ensureNoDuplicateEntries } from './entry-duplicates';
import { sessionLock } from './page-repository-utils';
import {
  importSessionIsComplete,
  orderPagesForReview,
} from './page-review-order';
import { commitVerifiedPage } from './verification-commit';
import { persistVerifiedEntries } from './verification-persistence';

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
      reviewOrder: 'page_number' | 'scan' | null;
      reviewPosition: number | null;
      status: 'awaiting_verification' | 'verified';
    }>`select id, extraction, import_expected_count as "expectedPageCount", import_position as position, review_order as "reviewOrder", review_position as "reviewPosition", status from pages where import_session_id = ${page.importSessionId} order by import_position, id`;
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
    yield* sql`update pages set review_order = ${ordered.order} where import_session_id = ${page.importSessionId}`;
    yield* Effect.forEach(
      ordered.pages,
      ({ id, reviewPosition }) =>
        sql`update pages set review_position = ${reviewPosition} where id = ${id} and import_session_id = ${page.importSessionId}`,
      { concurrency: 1 },
    );
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
    // One per-course lock serializes everything that must see the rows of
    // concurrent imports: position allocation for new units (whose unique
    // index remains the database invariant) and duplicate detection, which
    // has no index to fall back on because a duplicate's legality depends on
    // casing and example sentences.
    yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
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
    yield* ensureNoDuplicateEntries(sql, courseId, payload, unitIds);
    const entriesToInsert = payload.entries.flatMap((entry, index) =>
      entry.skipDuplicate === true ? [] : [{ entry, unitId: unitIds[index] }],
    );
    return yield* persistVerifiedEntries(
      sql,
      courseId,
      payload.pageId,
      entriesToInsert,
    );
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
        cause instanceof UnitNotFoundError ||
        cause instanceof DuplicateEntryError
          ? cause
          : databaseFailure(cause),
      ),
    );
};
