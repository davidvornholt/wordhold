import { useEffect, useEffectEvent, useState } from 'react';

// A drag from the file manager carries files; a drag of text or a link within
// the page does not and is left to the browser.
const carriesFiles = (transfer: DataTransfer | null): boolean =>
  transfer?.types.includes('Files') ?? false;

// Lets photos dropped anywhere on the capture screen join the queue, and
// reports whether such a drag is over the screen. A file drop is never left
// to the browser, which would open the photo in place of the screen. While
// the screen does not accept photos, the drop is refused.
export const useDroppedImages = (
  onFilesSelected: (files: ReadonlyArray<File>) => void,
  enabled: boolean,
): boolean => {
  const [dragging, setDragging] = useState(false);
  const accepts = useEffectEvent(() => enabled);
  const select = useEffectEvent((files: ReadonlyArray<File>) => {
    if (enabled) {
      onFilesSelected(files);
    }
  });
  useEffect(() => {
    // Crossing from one element to another enters the next before leaving
    // the last, so the drag has left the window once every enter is matched.
    let entered = 0;
    const onDragEnter = (event: DragEvent) => {
      if (carriesFiles(event.dataTransfer)) {
        entered += 1;
        setDragging(true);
      }
    };
    const onDragLeave = (event: DragEvent) => {
      if (carriesFiles(event.dataTransfer)) {
        entered = Math.max(entered - 1, 0);
        setDragging(entered > 0);
      }
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer !== null && carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = accepts() ? 'copy' : 'none';
      }
    };
    const onDrop = (event: DragEvent) => {
      if (event.dataTransfer !== null && carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        entered = 0;
        setDragging(false);
        select(Array.from(event.dataTransfer.files));
      }
    };
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, []);
  return dragging && enabled;
};
