import type { ExtractionResult } from '@wordhold/ai/extraction';
import { Effect } from 'effect';
import { Storage, type StorageShape } from '../../../shared/storage/server';
import {
  AudioGenerationStore,
  type AudioGenerationStoreShape,
} from './audio-generation-store';
import { ImportRepository, type ImportRepositoryShape } from './repository';

const page = {
  id: 'd9428888-122b-41e1-b85c-61cd3cbb3210',
  courseId: 'd9428888-122b-41e1-b85c-61cd3cbb3211',
  importSessionId: 'd9428888-122b-41e1-b85c-61cd3cbb3213',
  importPosition: 0,
  imagePath: 'pages/page.png',
  extraction: null,
  status: 'awaiting_verification' as const,
  capturedAt: new Date(0),
  verifiedAt: null,
};

const course = {
  id: page.courseId,
  name: 'Französisch',
  targetLanguage: 'fr' as const,
  nativeLanguage: 'de' as const,
  createdAt: new Date(0),
};

const unit = {
  id: 'd9428888-122b-41e1-b85c-61cd3cbb3212',
  name: 'Unité 3',
  position: 0,
  isHolding: false,
  entryCount: 12,
};

export const makeImportRepository = (
  overrides: Partial<ImportRepositoryShape> = {},
) =>
  ImportRepository.of({
    listOrSeedCourses: Effect.succeed([course]),
    getCourse: () => Effect.succeed(course),
    listPendingImportSessions: Effect.succeed([]),
    getImportSession: () =>
      Effect.succeed({
        id: page.importSessionId,
        courseId: page.courseId,
        courseName: course.name,
        capturedAt: page.capturedAt,
        expectedPageCount: 1,
        isComplete: true,
        pages: [
          {
            id: page.id,
            position: page.importPosition,
            status: page.status,
            extractionReady: page.extraction !== null,
          },
        ],
      }),
    listAudioRecoveryPages: Effect.succeed([]),
    getPage: () => Effect.succeed({ page, course }),
    getPageUpload: () => Effect.succeed(undefined),
    listUnits: () => Effect.succeed([unit]),
    listUnitEntries: () => Effect.succeed([]),
    loadPendingExtraction: () =>
      Effect.succeed({ imagePath: page.imagePath, language: 'fr' }),
    saveExtractionIfPending: (_pageId, extraction: ExtractionResult) =>
      Effect.succeed({ ...page, extraction }),
    insertPage: () => Effect.void,
    deletePendingImportSession: () => Effect.succeed([page.imagePath]),
    verifyPage: () => Effect.succeed([]),
    referencedPaths: Effect.succeed(new Set()),
    ...overrides,
  });

export const makeStorage = (overrides: Partial<StorageShape> = {}) =>
  Storage.of({
    write: () => Effect.void,
    writeIfAbsent: () => Effect.void,
    read: () => Effect.succeed(new Uint8Array()),
    remove: () => Effect.void,
    reconcile: () => Effect.succeed([]),
    ...overrides,
  });

export const makeAudioGenerationStore = (
  overrides: Partial<AudioGenerationStoreShape> = {},
) =>
  AudioGenerationStore.of({
    listMissingForPage: () => Effect.succeed([]),
    hasReference: () => Effect.succeed(false),
    upsertReference: () => Effect.void,
    withCriticalSection: (_entryId, effect) => effect,
    ...overrides,
  });
