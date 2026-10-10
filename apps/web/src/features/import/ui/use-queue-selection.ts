import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type QueuedPage, withoutQueuedPage } from '../services/upload-queue';
import { createQueueSelection } from './queue-selection';

export const useQueueSelection = () => {
  const previewUrlsRef = useRef(new Set<string>());
  // Content digests of queued pages, by page id; restored pages are hashed
  // the first time a selection has to be compared against them.
  const digestsRef = useRef(new Map<string, string>());
  const [pages, setPagesState] = useState<ReadonlyArray<QueuedPage>>([]);
  const pagesRef = useRef(pages);
  const selectionsRef = useRef<ReturnType<typeof createQueueSelection> | null>(
    null,
  );
  const setPages = useCallback(
    (update: SetStateAction<ReadonlyArray<QueuedPage>>) => {
      if (selectionsRef.current === null) {
        return;
      }
      const next =
        typeof update === 'function' ? update(pagesRef.current) : update;
      pagesRef.current = next;
      setPagesState(next);
    },
    [],
  );
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selections = createQueueSelection({
      getPages: () => pagesRef.current,
      onAdded: (added) => setPages((current) => [...current, ...added]),
      onBusy: setSelecting,
      onError: setError,
      digests: digestsRef.current,
      previewUrls: previewUrlsRef.current,
    });
    selectionsRef.current = selections;
    return () => {
      selections.dispose();
      selectionsRef.current = null;
    };
  }, [setPages]);

  const updatePage = (updated: QueuedPage): void => {
    setPages((current) =>
      current.map((page) => (page.id === updated.id ? updated : page)),
    );
  };

  const removePage = (pageId: string): void => {
    if (selectionsRef.current === null || selectionsRef.current.pending) {
      return;
    }
    setPages((current) => {
      const removed = current.find((page) => page.id === pageId);
      if (removed !== undefined) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current.delete(removed.previewUrl);
        digestsRef.current.delete(removed.id);
      }
      return withoutQueuedPage(current, pageId);
    });
  };

  return {
    pages,
    pagesRef,
    setPages,
    previewUrlsRef,
    updatePage,
    removePage,
    selectionsRef,
    selecting,
    error,
    setError,
  };
};
