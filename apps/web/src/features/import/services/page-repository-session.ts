import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { failure, sessionLock } from './page-repository-utils';
import type { PageUploadIdentity } from './repository';

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
