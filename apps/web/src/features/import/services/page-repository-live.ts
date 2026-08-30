import type { ExtractionResult } from '@wordhold/ai/extraction';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import type { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { insertPage } from './page-repository-insert';
import {
  deletePendingImportSession,
  getPageUpload,
} from './page-repository-session';
import { failure, sessionLock } from './page-repository-utils';
import {
  importSessionIsComplete,
  orderPagesForReview,
} from './page-review-order';
import {
  type AudioRecoveryPage,
  type ImportPageInput,
  type ImportSession,
  maximumAudioRecoveryPages,
  type Page,
} from './repository';

const listPendingImportSessions = (sql: Database) =>
  sql<{
    id: string;
    courseId: string;
    courseName: string;
    capturedAt: Date;
    pageCount: number;
    uploadedCount: number;
    verifiedCount: number;
    pendingCount: number;
    isComplete: boolean;
  }>`
    select pages.import_session_id as id,
      pages.course_id as "courseId",
      courses.name as "courseName",
      min(pages.captured_at) as "capturedAt",
      max(pages.import_expected_count)::integer as "pageCount",
      count(*)::integer as "uploadedCount",
      count(*) filter(where pages.status = 'verified')::integer as "verifiedCount",
      count(*) filter(where pages.status = 'awaiting_verification')::integer as "pendingCount",
      count(*)::integer = max(pages.import_expected_count)
        and max(pages.import_position) = max(pages.import_expected_count) - 1 as "isComplete"
    from pages
    inner join courses on pages.course_id = courses.id
    group by pages.import_session_id, pages.course_id, courses.name
    having count(*) filter(where pages.status = 'awaiting_verification') > 0
    order by min(pages.captured_at), pages.import_session_id
  `.pipe(
    Effect.mapError((cause) => failure('list pending import sessions', cause)),
  );

const getImportSession = (sql: Database, sessionId: string) =>
  sql<{
    sessionId: string;
    courseId: string;
    courseName: string;
    capturedAt: Date;
    pageId: string;
    position: number;
    expectedPageCount: number;
    reviewOrder: 'page_number' | 'scan' | null;
    status: 'awaiting_verification' | 'verified';
    extraction: unknown;
  }>`
    select pages.import_session_id as "sessionId",
      pages.course_id as "courseId",
      courses.name as "courseName",
      min(pages.captured_at) over(partition by pages.import_session_id) as "capturedAt",
      pages.id as "pageId",
      pages.import_position as position,
      pages.import_expected_count as "expectedPageCount",
      pages.review_order as "reviewOrder",
      pages.status,
      pages.extraction
    from pages
    inner join courses on pages.course_id = courses.id
    where pages.import_session_id = ${sessionId}
    order by pages.import_position, pages.id
  `.pipe(
    Effect.map((rows): ImportSession | undefined => {
      const [first] = rows;
      if (first === undefined) {
        return undefined;
      }
      const ordered = orderPagesForReview(rows);
      return {
        id: first.sessionId,
        courseId: first.courseId,
        courseName: first.courseName,
        capturedAt: first.capturedAt,
        expectedPageCount: first.expectedPageCount,
        isComplete: importSessionIsComplete(rows),
        reviewOrder: ordered.order,
        pages: ordered.pages.map((page) => ({
          id: page.pageId,
          position: page.position,
          status: page.status,
          extractionReady: page.extraction !== null,
          pageNumber: page.pageNumber,
        })),
      };
    }),
    Effect.mapError((cause) => failure('get import session', cause)),
  );

type AudioRecoveryRow = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly targetText: string;
  readonly language: LanguageCode;
  readonly audioProfiles: ReadonlyArray<string>;
  readonly verifiedAt: Date;
};

const listAudioRecoveryPages = (sql: Database) =>
  sql<AudioRecoveryRow>`
    select pages.id,
      pages.course_id as "courseId",
      courses.name as "courseName",
      entries.target_text as "targetText",
      courses.target_language as language,
      coalesce(
        array_agg(entry_audio.voice) filter (where entry_audio.voice is not null),
        array[]::text[]
      ) as "audioProfiles",
      pages.verified_at as "verifiedAt"
    from pages
    inner join courses on courses.id = pages.course_id
    inner join entries on entries.page_id = pages.id
    left join entry_audio on entry_audio.entry_id = entries.id
    where pages.status = 'verified'
      and pages.verified_at is not null
    group by pages.id, pages.course_id, courses.id, courses.name,
      entries.id, entries.target_text, courses.target_language,
      pages.verified_at, entries.created_at
    order by pages.verified_at, pages.id, entries.created_at, entries.id
  `.pipe(
    Effect.map((rows) => {
      const pages = new Map<string, AudioRecoveryPage>();
      for (const row of rows) {
        if (
          !row.audioProfiles.includes(
            ttsAudioProfile(row.targetText, row.language),
          )
        ) {
          const page = pages.get(row.id);
          if (page === undefined) {
            pages.set(row.id, {
              id: row.id,
              courseId: row.courseId,
              courseName: row.courseName,
              missingAudio: 1,
              verifiedAt: row.verifiedAt,
            });
          } else {
            pages.set(row.id, {
              ...page,
              missingAudio: page.missingAudio + 1,
            });
          }
        }
      }
      return [...pages.values()].slice(0, maximumAudioRecoveryPages);
    }),
    Effect.mapError((cause) => failure('list pages missing audio', cause)),
  );

export const pageRepositoryLive = (sql: Database) => ({
  listPendingImportSessions: listPendingImportSessions(sql),
  getImportSession: (sessionId: string) => getImportSession(sql, sessionId),
  listAudioRecoveryPages: listAudioRecoveryPages(sql),
  getPage: (pageId: string) =>
    sql<{
      pageId: string;
      courseId: string;
      imagePath: string;
      extraction: unknown;
      status: 'awaiting_verification' | 'verified';
      capturedAt: Date;
      verifiedAt: Date | null;
      courseName: string;
      targetLanguage: 'de' | 'en' | 'es' | 'fr';
      nativeLanguage: 'de' | 'en' | 'es' | 'fr';
      courseCreatedAt: Date;
      importSessionId: string;
      importPosition: number;
    }>`select pages.id as "pageId", pages.course_id as "courseId", pages.import_session_id as "importSessionId", pages.import_position as "importPosition", pages.image_path as "imagePath", pages.extraction, pages.status, pages.captured_at as "capturedAt", pages.verified_at as "verifiedAt", courses.name as "courseName", courses.target_language as "targetLanguage", courses.native_language as "nativeLanguage", courses.created_at as "courseCreatedAt" from pages inner join courses on pages.course_id = courses.id where pages.id = ${pageId} limit 1`.pipe(
      Effect.map((rows) => {
        const [row] = rows;
        return row === undefined
          ? undefined
          : {
              page: {
                id: row.pageId,
                courseId: row.courseId,
                importSessionId: row.importSessionId,
                importPosition: row.importPosition,
                imagePath: row.imagePath,
                extraction: row.extraction,
                status: row.status,
                capturedAt: row.capturedAt,
                verifiedAt: row.verifiedAt,
              },
              course: {
                id: row.courseId,
                name: row.courseName,
                targetLanguage: row.targetLanguage,
                nativeLanguage: row.nativeLanguage,
                createdAt: row.courseCreatedAt,
              },
            };
      }),
      Effect.mapError((cause) => failure('get page', cause)),
    ),
  getPageUpload: (pageId: string) => getPageUpload(sql, pageId),
  loadPendingExtraction: (pageId: string) =>
    sql<{
      imagePath: string;
      language: 'de' | 'en' | 'es' | 'fr';
    }>`select pages.image_path as "imagePath", courses.target_language as language from pages inner join courses on pages.course_id = courses.id where pages.id = ${pageId} and pages.status = 'awaiting_verification' limit 1`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError((cause) => failure('load pending extraction', cause)),
    ),
  saveExtractionIfPending: (pageId: string, extraction: ExtractionResult) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const pageRows = yield* sql<{
            importSessionId: string;
          }>`select import_session_id as "importSessionId" from pages where id = ${pageId} and status = 'awaiting_verification' limit 1`;
          const [page] = pageRows;
          if (page === undefined) {
            return;
          }
          yield* sessionLock(sql, page.importSessionId);
          const rows =
            yield* sql<Page>`update pages set extraction = ${JSON.stringify(extraction)}::jsonb where id = ${pageId} and status = 'awaiting_verification' returning id, course_id as "courseId", import_session_id as "importSessionId", import_position as "importPosition", image_path as "imagePath", extraction, status, captured_at as "capturedAt", verified_at as "verifiedAt"`;
          return rows[0];
        }),
      )
      .pipe(
        Effect.mapError((cause) => failure('save pending extraction', cause)),
      ),
  insertPage: (input: ImportPageInput) => insertPage(sql, input),
  deletePendingImportSession: (sessionId: string) =>
    deletePendingImportSession(sql, sessionId),
});
