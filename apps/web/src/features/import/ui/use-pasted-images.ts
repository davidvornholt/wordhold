import { useEffect } from 'react';

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement);

// Images from the clipboard, as pasted; anything else in the paste is left
// to the browser. A screenshot arrives as "image.png" without a real name,
// so the page position, not the file name, is what identifies it later.
export const pastedImages = (
  clipboard: { readonly files: ArrayLike<File> } | null,
): ReadonlyArray<File> =>
  Array.from(clipboard?.files ?? []).filter((file) =>
    acceptedImageTypes.has(file.type),
  );

// Lets Ctrl+V / Cmd+V add a page while the capture screen accepts photos.
// Pastes into a text field are not intercepted.
export const usePastedImages = (
  onFilesSelected: (files: ReadonlyArray<File>) => void,
  enabled: boolean,
): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onPaste = (event: ClipboardEvent) => {
      if (isEditable(event.target)) {
        return;
      }
      const files = pastedImages(event.clipboardData);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      onFilesSelected(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, onFilesSelected]);
};
