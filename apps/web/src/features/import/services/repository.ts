import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, type Effect } from 'effect';
import type { ImportDatabaseError } from '../errors/import-database-error';
import type { ImportInvariantError } from '../errors/import-invariant-error';
import type { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import type { UnitNotFoundError } from '../errors/unit-not-found-error';
import type { ImportPayloadData } from '../schemas/import-payload';

export type Course = {
  readonly id: string;
  readonly name: string;
  readonly targetLanguage: LanguageCode;
  readonly nativeLanguage: LanguageCode;
  readonly createdAt: Date;
};

export type Unit = {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly isHolding: boolean;
  readonly entryCount: number;
};

export type Page = {
  readonly id: string;
  readonly courseId: string;
  readonly importSessionId: string;
  readonly importPosition: number;
  readonly imagePath: string;
  readonly extraction: unknown;
  readonly status: 'awaiting_verification' | 'verified';
  readonly capturedAt: Date;
  readonly verifiedAt: Date | null;
};

export type PendingImportSession = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly capturedAt: Date;
  readonly pageCount: number;
  readonly pendingCount: number;
};

export type ImportSessionPage = {
  readonly id: string;
  readonly position: number;
  readonly status: 'awaiting_verification' | 'verified';
  readonly extractionReady: boolean;
};

export type ImportSession = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly capturedAt: Date;
  readonly pages: ReadonlyArray<ImportSessionPage>;
};

export const maximumAudioRecoveryPages = 50;

export type AudioRecoveryPage = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly missingAudio: number;
  readonly verifiedAt: Date;
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
  readonly listUnits: (
    courseId: string,
  ) => Effect.Effect<ReadonlyArray<Unit>, ImportDatabaseError>;
  readonly listPendingImportSessions: Effect.Effect<
    ReadonlyArray<PendingImportSession>,
    ImportDatabaseError
  >;
  readonly getImportSession: (
    sessionId: string,
  ) => Effect.Effect<ImportSession | undefined, ImportDatabaseError>;
  readonly listAudioRecoveryPages: Effect.Effect<
    ReadonlyArray<AudioRecoveryPage>,
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
    readonly importSessionId: string;
    readonly importPosition: number;
    readonly imagePath: string;
  }) => Effect.Effect<void, ImportDatabaseError>;
  readonly deletePendingImportSession: (
    sessionId: string,
  ) => Effect.Effect<ReadonlyArray<string>, ImportDatabaseError>;
  readonly verifyPage: (
    payload: ImportPayloadData,
    courseId: string,
  ) => Effect.Effect<
    ReadonlyArray<InsertedEntry>,
    RepositoryFailure | PageAlreadyVerifiedError | UnitNotFoundError
  >;
  readonly referencedPaths: Effect.Effect<
    ReadonlySet<string>,
    ImportDatabaseError
  >;
};

export class ImportRepository extends Context.Tag(
  '@wordhold/web/import/ImportRepository',
)<ImportRepository, ImportRepositoryShape>() {}
