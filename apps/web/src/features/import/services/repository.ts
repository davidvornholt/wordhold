import type { ExtractionResult } from '@wordhold/ai/extraction';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { Context, type Effect } from 'effect';
import type { BookNotFoundError } from '../errors/book-not-found-error';
import type { DuplicateEntryError } from '../errors/duplicate-entry-error';
import type { ImportDatabaseError } from '../errors/import-database-error';
import type { ImportInvariantError } from '../errors/import-invariant-error';
import type { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import type { UnitNotFoundError } from '../errors/unit-not-found-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import type { PageReviewOrder } from './page-review-order';

export type Course = {
  readonly id: string;
  readonly name: string;
  readonly kind: CourseKind;
  readonly targetLanguage: LanguageCode;
  readonly nativeLanguage: LanguageCode;
  readonly createdAt: Date;
};

export type Book = {
  readonly id: string;
  readonly name: string;
  // When a word was last filed into this book, so the verify screen can
  // preselect the book the learner is working through. Null for a book
  // without vocabulary.
  readonly lastImportedAt: Date | null;
};

export type Unit = {
  readonly id: string;
  readonly bookId: string;
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
  readonly uploadedCount: number;
  readonly verifiedCount: number;
  readonly pendingCount: number;
  readonly isComplete: boolean;
};

export type ImportSessionPage = {
  readonly id: string;
  readonly pageNumber: number | null;
  readonly position: number;
  readonly status: 'awaiting_verification' | 'verified';
  readonly extractionReady: boolean;
};

export type ImportSession = {
  readonly id: string;
  readonly courseId: string;
  readonly courseName: string;
  readonly capturedAt: Date;
  readonly expectedPageCount: number;
  readonly isComplete: boolean;
  readonly reviewOrder: PageReviewOrder;
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

export type ImportPageInput = {
  readonly id: string;
  readonly courseId: string;
  readonly importSessionId: string;
  readonly importPosition: number;
  readonly importExpectedCount: number;
  readonly imagePath: string;
};

export type PageUploadIdentity = Pick<
  ImportPageInput,
  | 'id'
  | 'courseId'
  | 'importSessionId'
  | 'importPosition'
  | 'importExpectedCount'
  | 'imagePath'
>;

// A page leaving a batch that is still being captured, as the learner's queue
// knows it. A photo whose upload failed holds its position only there.
export type ImportPageRemoval = {
  readonly courseId: string;
  readonly importSessionId: string;
  readonly pageId: string;
  readonly position: number;
};

export type InsertedEntry = {
  readonly id: string;
  readonly targetText: string;
};

// One stored word with its example sentences and where it is filed: what the
// verify screen needs to flag a word the course already has, in any book.
export type UnitEntry = {
  // "Book · Unit", or the book alone, as the learner reads it.
  readonly location: string;
  readonly targetText: string;
  readonly examples: ReadonlyArray<string>;
};

type RepositoryFailure = ImportDatabaseError | ImportInvariantError;

export type ImportRepositoryShape = {
  // A person's courses, starting them off with the default languages.
  readonly listOrSeedCourses: (
    ownerId: string,
  ) => Effect.Effect<ReadonlyArray<Course>, ImportDatabaseError>;
  readonly getCourse: (
    courseId: string,
  ) => Effect.Effect<Course | undefined, ImportDatabaseError>;
  readonly listBooks: (
    courseId: string,
  ) => Effect.Effect<ReadonlyArray<Book>, ImportDatabaseError>;
  readonly listUnits: (
    courseId: string,
  ) => Effect.Effect<ReadonlyArray<Unit>, ImportDatabaseError>;
  readonly listUnitEntries: (
    courseId: string,
  ) => Effect.Effect<ReadonlyArray<UnitEntry>, ImportDatabaseError>;
  readonly listPendingImportSessions: (
    ownerId: string,
  ) => Effect.Effect<ReadonlyArray<PendingImportSession>, ImportDatabaseError>;
  readonly getImportSession: (
    sessionId: string,
  ) => Effect.Effect<ImportSession | undefined, ImportDatabaseError>;
  readonly listAudioRecoveryPages: (
    ownerId: string,
  ) => Effect.Effect<ReadonlyArray<AudioRecoveryPage>, ImportDatabaseError>;
  readonly getPage: (
    pageId: string,
  ) => Effect.Effect<
    { readonly page: Page; readonly course: Course } | undefined,
    ImportDatabaseError
  >;
  readonly getPageUpload: (
    pageId: string,
  ) => Effect.Effect<PageUploadIdentity | undefined, ImportDatabaseError>;
  readonly loadPendingExtraction: (
    pageId: string,
  ) => Effect.Effect<PendingExtraction | undefined, ImportDatabaseError>;
  readonly saveExtractionIfPending: (
    pageId: string,
    extraction: ExtractionResult,
  ) => Effect.Effect<Page | undefined, ImportDatabaseError>;
  readonly insertPage: (
    input: ImportPageInput,
  ) => Effect.Effect<void, ImportDatabaseError>;
  readonly deletePendingImportSession: (
    sessionId: string,
  ) => Effect.Effect<ReadonlyArray<string>, ImportDatabaseError>;
  // Undefined once the batch review has started; otherwise the stored image
  // the page leaves behind, if it was uploaded.
  readonly removePendingImportPage: (
    removal: ImportPageRemoval,
  ) => Effect.Effect<
    { readonly imagePath: string | null } | undefined,
    ImportDatabaseError
  >;
  readonly verifyPage: (
    payload: ImportPayloadData,
    courseId: string,
  ) => Effect.Effect<
    ReadonlyArray<InsertedEntry>,
    | RepositoryFailure
    | PageAlreadyVerifiedError
    | BookNotFoundError
    | UnitNotFoundError
    | DuplicateEntryError
  >;
  readonly referencedPaths: Effect.Effect<
    ReadonlySet<string>,
    ImportDatabaseError
  >;
};

export class ImportRepository extends Context.Service<
  ImportRepository,
  ImportRepositoryShape
>()('@wordhold/web/import/ImportRepository') {}
