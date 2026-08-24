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
  label: null,
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

export const makeImportRepository = (
  overrides: Partial<ImportRepositoryShape> = {},
) =>
  ImportRepository.of({
    listOrSeedCourses: Effect.succeed([course]),
    getCourse: () => Effect.succeed(course),
    listPendingPages: Effect.succeed([]),
    listAudioRecoveryPages: Effect.succeed([]),
    getPage: () => Effect.succeed({ page, course }),
    loadPendingExtraction: () =>
      Effect.succeed({ imagePath: page.imagePath, language: 'fr' }),
    saveExtractionIfPending: (_pageId, extraction: ExtractionResult) =>
      Effect.succeed({ ...page, extraction }),
    insertPage: () => Effect.void,
    verifyPage: () => Effect.succeed([]),
    referencedPaths: Effect.succeed(new Set()),
    ...overrides,
  });

export const makeStorage = (overrides: Partial<StorageShape> = {}) =>
  Storage.of({
    write: () => Effect.void,
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
