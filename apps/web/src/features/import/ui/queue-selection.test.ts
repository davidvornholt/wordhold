import { expect, it } from 'bun:test';
import {
  fileDigest,
  maximumUploadBatchSize,
  type QueuedPage,
} from '../services/upload-queue';
import { createQueueSelection } from './queue-selection';

const scenarios = [
  {
    name: 'duplicate selections',
    notice: '1 Foto war schon in der Auswahl.',
    count: 1,
    same: true,
    reject: false,
    dispose: false,
    expected: 1,
  },
  {
    name: 'over-capacity selections',
    notice:
      '2 von 8 neuen Fotos wurden hinzugefügt. Pro Durchgang sind höchstens 10 möglich.',
    count: 8,
    same: false,
    reject: false,
    dispose: false,
    expected: maximumUploadBatchSize,
  },
  {
    name: 'failed hashing followed by another selection',
    notice: null,
    count: 1,
    same: false,
    reject: true,
    dispose: false,
    expected: 1,
  },
  {
    name: 'unmount during hashing',
    notice: null,
    count: 1,
    same: false,
    reject: false,
    dispose: true,
    expected: 0,
  },
];

it.each(scenarios)(
  'serializes the selection lifetime: $name',
  async (scenario) => {
    const digestStarted = Promise.withResolvers<void>();
    const digestRelease = Promise.withResolvers<ArrayBuffer>();
    const delayed = new File(['first'], 'first.png', { type: 'image/png' });
    Object.defineProperty(delayed, 'arrayBuffer', {
      value: () => {
        digestStarted.resolve();
        return digestRelease.promise;
      },
    });
    const photos = Array.from({ length: scenario.count }, (_, index) =>
      index === 0 ? delayed : new File([`first-${index}`], `${index}.png`),
    );
    const nextPhotos = scenario.same
      ? photos
      : Array.from(
          { length: scenario.count },
          (_, index) => new File([`next-${index}`], `${index}.png`),
        );
    let pages: ReadonlyArray<QueuedPage> = [];
    let busy = false;
    const errors: Array<string | null> = [];
    const previews = new Set<string>();
    const digests = new Map<string, string>();
    const selection = createQueueSelection({
      getPages: () => pages,
      onAdded: (added) => {
        pages = [...pages, ...added];
      },
      onBusy: (value) => {
        busy = value;
      },
      onError: (error) => {
        errors.push(error);
      },
      digests,
      previewUrls: previews,
    });
    const first = selection.addFiles(photos);
    const next = selection.addFiles(nextPhotos);
    expect(selection.pending).toBe(true);
    expect(busy).toBe(true);
    await digestStarted.promise;
    expect(pages).toHaveLength(0);
    if (scenario.dispose) {
      selection.dispose();
    }
    if (scenario.reject) {
      digestRelease.reject(new Error('Unreadable file'));
    } else {
      digestRelease.resolve(await new Blob(['first']).arrayBuffer());
    }
    await Promise.all([first, next]);
    expect(selection.pending).toBe(false);
    expect(pages).toHaveLength(scenario.expected);
    expect(new Set(pages.map((page) => page.position)).size).toBe(pages.length);
    expect(
      new Set(await Promise.all(pages.map((page) => fileDigest(page.file))))
        .size,
    ).toBe(pages.length);
    expect(previews.size).toBe(pages.length);
    expect(digests.size).toBe(pages.length);
    expect(busy).toBe(scenario.dispose);
    expect(
      errors.includes(
        'Das Foto konnte nicht gelesen werden. Wähle die Datei erneut.',
      ),
    ).toBe(scenario.reject);
    expect(errors.at(-1)).toBe(scenario.notice);
    selection.dispose();
    for (const preview of previews) {
      URL.revokeObjectURL(preview);
    }
  },
);
