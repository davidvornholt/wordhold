import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { failure, sessionLock } from './page-repository-utils';
import type { ImportPageInput } from './repository';

export const insertPage = (sql: Database, input: ImportPageInput) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        yield* sessionLock(sql, input.importSessionId);
        const abandonedSession = yield* sql<{
          id: string;
        }>`select id from import_session_tombstones where id = ${input.importSessionId} limit 1`;
        if (abandonedSession.length > 0) {
          return yield* Effect.fail(
            new Error('The upload session has already been discarded.'),
          );
        }
        const existingPage = yield* sql<{
          courseId: string;
          importSessionId: string;
          importPosition: number;
          importExpectedCount: number;
          imagePath: string;
        }>`select course_id as "courseId", import_session_id as "importSessionId", import_position as "importPosition", import_expected_count as "importExpectedCount", image_path as "imagePath" from pages where id = ${input.id} limit 1`;
        const [page] = existingPage;
        if (page !== undefined) {
          if (
            page.courseId !== input.courseId ||
            page.importSessionId !== input.importSessionId ||
            page.importPosition !== input.importPosition ||
            page.importExpectedCount !== input.importExpectedCount ||
            page.imagePath !== input.imagePath
          ) {
            return yield* Effect.fail(
              new Error('The upload page identity does not match.'),
            );
          }
          return;
        }
        const sessionRows = yield* sql<{
          courseId: string;
          importExpectedCount: number;
        }>`select course_id as "courseId", import_expected_count as "importExpectedCount" from pages where import_session_id = ${input.importSessionId} limit 1`;
        const [session] = sessionRows;
        if (
          session !== undefined &&
          (session.courseId !== input.courseId ||
            session.importExpectedCount !== input.importExpectedCount)
        ) {
          return yield* Effect.fail(
            new Error('The upload session identity does not match.'),
          );
        }
        yield* sql`insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path) values (${input.id}, ${input.courseId}, ${input.importSessionId}, ${input.importPosition}, ${input.importExpectedCount}, ${input.imagePath})`;
      }),
    )
    .pipe(
      Effect.asVoid,
      Effect.mapError((cause) => failure('insert page', cause)),
    );
