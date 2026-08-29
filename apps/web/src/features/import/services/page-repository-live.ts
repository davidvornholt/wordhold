import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import {
  type AudioRecoveryPage,
  maximumAudioRecoveryPages,
  type Page,
} from './repository';

const failure = (operation: string, cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

export const pageRepositoryLive = (sql: Database) => ({
  listPendingPages: sql<{
    id: string;
    courseId: string;
    courseName: string;
    label: string | null;
    capturedAt: Date;
  }>`select pages.id, pages.course_id as "courseId", courses.name as "courseName", pages.label, pages.captured_at as "capturedAt" from pages inner join courses on pages.course_id = courses.id where pages.status = 'awaiting_verification' order by pages.captured_at`.pipe(
    Effect.mapError((cause) => failure('list pending pages', cause)),
  ),
  listAudioRecoveryPages: sql<AudioRecoveryPage>`
    select pages.id,
      pages.course_id as "courseId",
      courses.name as "courseName",
      pages.label,
      count(entries.id)::integer as "missingAudio",
      pages.verified_at as "verifiedAt"
    from pages
    inner join courses on courses.id = pages.course_id
    inner join entries on entries.page_id = pages.id
    where pages.status = 'verified'
      and pages.verified_at is not null
      and not exists(
        select 1 from entry_audio where entry_audio.entry_id = entries.id
      )
    group by pages.id, courses.id
    order by pages.verified_at, pages.id
    limit ${maximumAudioRecoveryPages}
  `.pipe(
    Effect.mapError((cause) => failure('list pages missing audio', cause)),
  ),
  getPage: (pageId: string) =>
    sql<{
      pageId: string;
      courseId: string;
      label: string | null;
      imagePath: string;
      extraction: unknown;
      status: 'awaiting_verification' | 'verified';
      capturedAt: Date;
      verifiedAt: Date | null;
      courseName: string;
      targetLanguage: 'de' | 'en' | 'es' | 'fr';
      nativeLanguage: 'de' | 'en' | 'es' | 'fr';
      courseCreatedAt: Date;
    }>`select pages.id as "pageId", pages.course_id as "courseId", pages.label, pages.image_path as "imagePath", pages.extraction, pages.status, pages.captured_at as "capturedAt", pages.verified_at as "verifiedAt", courses.name as "courseName", courses.target_language as "targetLanguage", courses.native_language as "nativeLanguage", courses.created_at as "courseCreatedAt" from pages inner join courses on pages.course_id = courses.id where pages.id = ${pageId} limit 1`.pipe(
      Effect.map((rows) => {
        const [row] = rows;
        return row === undefined
          ? undefined
          : {
              page: {
                id: row.pageId,
                courseId: row.courseId,
                label: row.label,
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
  loadPendingExtraction: (pageId: string) =>
    sql<{
      imagePath: string;
      language: 'de' | 'en' | 'es' | 'fr';
    }>`select pages.image_path as "imagePath", courses.target_language as language from pages inner join courses on pages.course_id = courses.id where pages.id = ${pageId} and pages.status = 'awaiting_verification' limit 1`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError((cause) => failure('load pending extraction', cause)),
    ),
  saveExtractionIfPending: (pageId: string, extraction: ExtractionResult) =>
    sql<Page>`update pages set extraction = ${JSON.stringify(extraction)}::jsonb, label = coalesce(label, ${extraction.page.pageLabel ?? null}) where id = ${pageId} and status = 'awaiting_verification' returning id, course_id as "courseId", label, image_path as "imagePath", extraction, status, captured_at as "capturedAt", verified_at as "verifiedAt"`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError((cause) => failure('save pending extraction', cause)),
    ),
  insertPage: (input: {
    readonly id: string;
    readonly courseId: string;
    readonly imagePath: string;
  }) =>
    sql`insert into pages (id, course_id, image_path) values (${input.id}, ${input.courseId}, ${input.imagePath})`.pipe(
      Effect.asVoid,
      Effect.mapError((cause) => failure('insert page', cause)),
    ),
  deletePendingPage: (pageId: string) =>
    sql<{
      imagePath: string;
    }>`delete from pages where id = ${pageId} and status = 'awaiting_verification' returning image_path as "imagePath"`.pipe(
      Effect.map((rows) => rows[0]?.imagePath),
      Effect.mapError((cause) => failure('delete pending page', cause)),
    ),
});
