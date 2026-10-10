import { type RefObject, useRef, useState } from 'react';

export type QueueLock = {
  readonly busy: boolean;
  readonly held: () => boolean;
  readonly run: (operation: () => Promise<void>) => Promise<void>;
};

// The queue runs one server operation at a time: processing pages or taking
// a page out of a started batch. Once the queue is gone, signalled by its
// cleared selection, the lock no longer updates the screen.
export const useQueueLock = (selectionsRef: RefObject<unknown>): QueueLock => {
  const heldRef = useRef(false);
  const [busy, setBusy] = useState(false);
  return {
    busy,
    held: () => heldRef.current,
    run: async (operation) => {
      heldRef.current = true;
      setBusy(true);
      try {
        await operation();
      } finally {
        heldRef.current = false;
        if (selectionsRef.current !== null) {
          setBusy(false);
        }
      }
    },
  };
};
