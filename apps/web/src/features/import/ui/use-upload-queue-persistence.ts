import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { QueuedPage } from '../services/upload-queue';
import {
  clearUploadQueue,
  loadUploadQueue,
  restoreUploadQueue,
  saveUploadQueue,
  serializeUploadQueue,
} from '../services/upload-queue-persistence';

type UseUploadQueuePersistenceOptions = {
  readonly courseId: string;
  readonly importSessionId: string;
  readonly pages: ReadonlyArray<QueuedPage>;
  readonly previewUrls: RefObject<Set<string>>;
  readonly processingStarted: boolean;
  readonly setImportSessionId: Dispatch<SetStateAction<string>>;
  readonly setPages: Dispatch<SetStateAction<ReadonlyArray<QueuedPage>>>;
  readonly setProcessingStarted: Dispatch<SetStateAction<boolean>>;
};

export const useUploadQueuePersistence = ({
  courseId,
  importSessionId,
  pages,
  previewUrls,
  processingStarted,
  setImportSessionId,
  setPages,
  setProcessingStarted,
}: UseUploadQueuePersistenceOptions) => {
  const [hydratedCourseId, setHydratedCourseId] = useState<string | null>(null);
  const persistenceQueue = useRef(Promise.resolve());
  const hydrated = hydratedCourseId === courseId;

  useEffect(() => {
    let mounted = true;
    loadUploadQueue(courseId)
      .then((stored) => {
        if (!mounted || stored === undefined || stored.courseId !== courseId) {
          return;
        }
        const restored = restoreUploadQueue(stored);
        for (const page of restored) {
          previewUrls.current.add(page.previewUrl);
        }
        setImportSessionId(stored.importSessionId);
        setProcessingStarted(stored.processingStarted);
        setPages(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setHydratedCourseId(courseId);
        }
      });
    return () => {
      mounted = false;
    };
  }, [
    courseId,
    previewUrls,
    setImportSessionId,
    setPages,
    setProcessingStarted,
  ]);

  useEffect(
    () => () => {
      for (const previewUrl of previewUrls.current) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrls],
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const operation =
      pages.length === 0
        ? () => clearUploadQueue(courseId)
        : () =>
            saveUploadQueue(
              courseId,
              serializeUploadQueue(
                courseId,
                importSessionId,
                processingStarted,
                pages,
              ),
            );
    persistenceQueue.current = persistenceQueue.current
      .then(operation)
      .catch(() => undefined);
  }, [courseId, hydrated, importSessionId, pages, processingStarted]);

  return {
    hydrated,
    clearPersistedQueue: () => {
      persistenceQueue.current = persistenceQueue.current
        .then(() => clearUploadQueue(courseId))
        .catch(() => undefined);
    },
  };
};
