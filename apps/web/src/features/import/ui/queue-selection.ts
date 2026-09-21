import {
  type FileSelection,
  fileDigest,
  maximumUploadBatchSize,
  nextUploadPosition,
  type QueuedPage,
  selectFiles,
} from '../services/upload-queue';

export const selectionNotice = ({
  accepted,
  duplicates,
  overLimit,
}: FileSelection): string | null => {
  const notices = [
    duplicates === 0
      ? null
      : `${duplicates === 1 ? '1 Foto war' : `${duplicates} Fotos waren`} schon in der Auswahl.`,
    overLimit === 0
      ? null
      : `${accepted.length} von ${accepted.length + overLimit} neuen Fotos wurden hinzugefügt. Pro Durchgang sind höchstens ${maximumUploadBatchSize} möglich.`,
  ].filter((notice): notice is string => notice !== null);
  return notices.length === 0 ? null : notices.join(' ');
};

type QueueSelectionInput = {
  readonly files: ReadonlyArray<File>;
  readonly pages: ReadonlyArray<QueuedPage>;
  // Content digests by page id; pages restored from storage are hashed here
  // the first time a selection has to be compared against them.
  readonly digests: Map<string, string>;
  readonly previewUrls: Set<string>;
};

// Turns a file selection into new queue pages: bytes already queued are
// dropped, the batch size is respected, and each new page gets its position,
// preview and digest.
export const queueSelectedFiles = async ({
  files,
  pages,
  digests,
  previewUrls,
}: QueueSelectionInput): Promise<{
  readonly added: ReadonlyArray<QueuedPage>;
  readonly notice: string | null;
}> => {
  await Promise.all(
    pages
      .filter((page) => !digests.has(page.id))
      .map(async (page) => {
        digests.set(page.id, await fileDigest(page.file));
      }),
  );
  const known = new Set(pages.map((page) => digests.get(page.id) ?? ''));
  const selection = await selectFiles(
    files,
    known,
    maximumUploadBatchSize - pages.length,
  );
  const usedPositions = new Set(pages.map((page) => page.position));
  const added = selection.accepted.map(({ file, digest }): QueuedPage => {
    const position = nextUploadPosition(usedPositions);
    usedPositions.add(position);
    const previewUrl = URL.createObjectURL(file);
    previewUrls.add(previewUrl);
    const id = crypto.randomUUID();
    digests.set(id, digest);
    return { id, file, position, previewUrl, stage: 'waiting' };
  });
  return { added, notice: selectionNotice(selection) };
};
