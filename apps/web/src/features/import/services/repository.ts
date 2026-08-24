import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, type Effect } from 'effect';
import type { ImportDatabaseError } from '../errors/import-database-error';
import type { ImportInvariantError } from '../errors/import-invariant-error';
import type { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import type { ImportPayloadData } from '../schemas/import-payload';

export type Course = {
  readonly id: string;
  readonly name: string;
  readonly targetLanguage: LanguageCode;
  readonly nativeLanguage: LanguageCode;
  readonly createdAt: Date;
};

export type Page = {
  readonly id: string;
  readonly courseId: string;
  readonly label: string | null;
  readonly imagePath: string;
  readonly extraction: unknown;
  readonly status: 'awaiting_verification' | 'verified';
  readonly capturedAt: Date;
  readonly verifiedAt: Date | null;
};

export type PendingPage = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly label: string | null;
  readonly capturedAt: Date;
};

export type PendingExtraction = {
  readonly imagePath: string;
  readonly language: LanguageCode;
};

export type InsertedEntry = {
  readonly id: string;
  readonly targetText: string;
};

type RepositoryFailure = ImportDatabaseError | ImportInvariantError;

export type ImportRepositoryShape = {
  readonly listOrSeedCourses: Effect.Effect<
    ReadonlyArray<Course>,
    ImportDatabaseError
  >;
  readonly getCourse: (
    courseId: string,
  ) => Effect.Effect<Course | undefined, ImportDatabaseError>;
  readonly listPendingPages: Effect.Effect<
    ReadonlyArray<PendingPage>,
    ImportDatabaseError
  >;
  readonly getPage: (
    pageId: string,
  ) => Effect.Effect<
    { readonly page: Page; readonly course: Course } | undefined,
    ImportDatabaseError
  >;
  readonly loadPendingExtraction: (
    pageId: string,
  ) => Effect.Effect<PendingExtraction | undefined, ImportDatabaseError>;
  readonly saveExtractionIfPending: (
    pageId: string,
    extraction: ExtractionResult,
  ) => Effect.Effect<Page | undefined, ImportDatabaseError>;
  readonly insertPage: (input: {
    readonly id: string;
    readonly courseId: string;
    readonly imagePath: string;
  }) => Effect.Effect<void, ImportDatabaseError>;
  readonly verifyPage: (
    payload: ImportPayloadData,
    courseId: string,
  ) => Effect.Effect<
    ReadonlyArray<InsertedEntry>,
    RepositoryFailure | PageAlreadyVerifiedError
  >;
  readonly referencedPaths: Effect.Effect<
    ReadonlySet<string>,
    ImportDatabaseError
  >;
  readonly upsertAudioReference: (
    entryId: string,
    voice: string,
    path: string,
  ) => Effect.Effect<void, ImportDatabaseError>;
};

export class ImportRepository extends Context.Tag(
  '@wordhold/web/import/ImportRepository',
)<ImportRepository, ImportRepositoryShape>() {}
