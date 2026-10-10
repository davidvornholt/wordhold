import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { failure, sessionLock } from './page-repository-utils';
import type { ImportPageRemoval, PageUploadIdentity } from './repository';

export const getPageUpload = (sql: Database, pageId: string) =>
  sql<PageUploadIdentity>`select id, course_id as "courseId", import_session_id as "importSessionId", import_position as "importPosition", import_expected_count as "importExpectedCount", image_path as "imagePath" from pages where id = ${pageId} limit 1`.pipe(
    Effect.map((rows) => rows[0]),
    Effect.mapError((cause) => failure('get page upload identity', cause)),
  );

export const deletePendingImportSession = (sql: Database, sessionId: string) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        yield* sessionLock(sql, sessionId);
        const pending = yield* sql<{
          imagePath: string;
        }>`select image_path as "imagePath" from pages where import_session_id = ${sessionId} and status = 'awaiting_verification'`;
        yield* sql`insert into import_session_tombstones (id) values (${sessionId}) on conflict (id) do nothing`;
        yield* sql`delete from pages where import_session_id = ${sessionId} and status = 'awaiting_verification'`;
        return pending.map((row) => row.imagePath);
      }),
    )
    .pipe(
      Effect.mapError((cause) =>
        failure('delete pending import session', cause),
      ),
    );

// Later pages move up one position and every stored page learns the smaller
// batch size, so the session completes once the remaining photos are stored.
export const removePendingImportPage = (
  sql: Database,
  removal: ImportPageRemoval,
) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        yield* sessionLock(sql, removal.importSessionId);
        const reviewStarted = yield* sql<{
          id: string;
        }>`select id from pages where import_session_id = ${removal.importSessionId} and (status <> 'awaiting_verification' or review_order is not null) limit 1`;
        if (reviewStarted.length > 0) {
          return;
        }
        const removed = yield* sql<{
          imagePath: string;
          position: number;
        }>`delete from pages where id = ${removal.pageId} and import_session_id = ${removal.importSessionId} and course_id = ${removal.courseId} returning image_path as "imagePath", import_position as position`;
        const [page] = removed;
        if (page !== undefined && page.position !== removal.position) {
          return yield* Effect.fail(
            new Error('The removed page position does not match.'),
          );
        }
        const later = yield* sql<{
          id: string;
        }>`select id from pages where import_session_id = ${removal.importSessionId} and course_id = ${removal.courseId} and import_position > ${removal.position} order by import_position`;
        // In ascending order, each page moves into the position the one
        // before it just left, so the unique session position never collides.
        yield* Effect.forEach(
          later,
          (row) =>
            sql`update pages set import_position = import_position - 1 where id = ${row.id}`,
          { discard: true },
        );
        yield* sql`update pages set import_expected_count = import_expected_count - 1 where import_session_id = ${removal.importSessionId} and course_id = ${removal.courseId}`;
        return { imagePath: page?.imagePath ?? null };
      }),
    )
    .pipe(
      Effect.mapError((cause) => failure('remove pending import page', cause)),
    );
