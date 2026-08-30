import type { QueuedPage } from './upload-queue';

const databaseName = 'wordhold-import-queues';
const objectStoreName = 'queues';
const databaseVersion = 1;

type PersistedPage = {
  readonly id: string;
  readonly position: number;
  readonly file: Blob;
  readonly fileName: string;
  readonly fileType: string;
  readonly fileLastModified: number;
  readonly stage: 'waiting' | 'ready' | 'failed';
  readonly pageId: string | null;
  readonly error: string | null;
};

export type PersistedUploadQueue = {
  readonly courseId: string;
  readonly importSessionId: string;
  readonly processingStarted: boolean;
  readonly pages: ReadonlyArray<PersistedPage>;
};

const openDatabase = (): Promise<IDBDatabase> => {
  const factory = globalThis.indexedDB;
  if (factory === undefined) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open IndexedDB.'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });

export const loadUploadQueue = async (
  courseId: string,
): Promise<PersistedUploadQueue | undefined> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(objectStoreName, 'readonly');
    return (await requestResult(
      transaction.objectStore(objectStoreName).get(courseId),
    )) as PersistedUploadQueue | undefined;
  } finally {
    database.close();
  }
};

export const saveUploadQueue = async (
  courseId: string,
  queue: PersistedUploadQueue,
): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(objectStoreName, 'readwrite');
    transaction.objectStore(objectStoreName).put(queue, courseId);
    await new Promise<void>((resolve, reject) => {
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB write failed.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB write aborted.'));
      transaction.oncomplete = () => resolve();
    });
  } finally {
    database.close();
  }
};

export const clearUploadQueue = async (courseId: string): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(objectStoreName, 'readwrite');
    transaction.objectStore(objectStoreName).delete(courseId);
    await new Promise<void>((resolve, reject) => {
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB delete failed.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB delete aborted.'));
      transaction.oncomplete = () => resolve();
    });
  } finally {
    database.close();
  }
};

const persistedPage = (page: QueuedPage): PersistedPage => {
  const file = {
    file: page.file,
    fileName: page.file.name,
    fileType: page.file.type,
    fileLastModified: page.file.lastModified,
  };
  switch (page.stage) {
    case 'waiting':
      return { ...page, ...file, stage: page.stage, pageId: null, error: null };
    case 'uploading':
      return {
        ...page,
        ...file,
        stage: 'failed',
        pageId: null,
        error: 'Der Upload wurde unterbrochen. Bitte erneut versuchen.',
      };
    case 'extracting':
      return {
        ...page,
        ...file,
        stage: 'failed',
        pageId: page.pageId,
        error: 'Das Auslesen wurde unterbrochen. Bitte erneut versuchen.',
      };
    case 'ready':
      return { ...page, ...file, stage: page.stage, error: null };
    case 'failed':
      return { ...page, ...file, stage: page.stage };
    default:
      return page satisfies never;
  }
};

export const serializeUploadQueue = (
  courseId: string,
  importSessionId: string,
  processingStarted: boolean,
  pages: ReadonlyArray<QueuedPage>,
): PersistedUploadQueue => ({
  courseId,
  importSessionId,
  processingStarted,
  pages: pages.map(persistedPage),
});

export const restoreUploadQueue = (
  queue: PersistedUploadQueue,
): ReadonlyArray<QueuedPage> =>
  queue.pages.map((page): QueuedPage => {
    const file = new File([page.file], page.fileName, {
      lastModified: page.fileLastModified,
      type: page.fileType,
    });
    const base = {
      id: page.id,
      file,
      position: page.position,
      previewUrl: URL.createObjectURL(file),
    };
    if (page.stage === 'ready') {
      return { ...base, stage: page.stage, pageId: page.pageId ?? page.id };
    }
    if (page.stage === 'failed') {
      return {
        ...base,
        stage: page.stage,
        pageId: page.pageId,
        error: page.error ?? 'Die Verarbeitung wurde unterbrochen.',
      };
    }
    return { ...base, stage: page.stage };
  });
