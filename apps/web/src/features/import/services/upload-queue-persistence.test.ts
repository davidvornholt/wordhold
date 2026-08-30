import { describe, expect, it } from 'bun:test';
import type { QueuedPage } from './upload-queue';
import {
  restoreUploadQueue,
  serializeUploadQueue,
} from './upload-queue-persistence';

const expectedLastModified = 1234;
const file = new File(['page'], 'page.jpg', {
  lastModified: expectedLastModified,
  type: 'image/jpeg',
});

const page = (
  id: string,
  position: number,
  stage: QueuedPage['stage'],
): QueuedPage => {
  const base = {
    id,
    file,
    position,
    previewUrl: `blob:${id}`,
  };
  if (stage === 'extracting' || stage === 'ready') {
    return { ...base, stage, pageId: `stored-${id}` };
  }
  if (stage === 'failed') {
    return {
      ...base,
      stage,
      pageId: position === 0 ? null : `stored-${id}`,
      error: 'Verarbeitung fehlgeschlagen.',
    };
  }
  return { ...base, stage };
};

describe('upload queue persistence', () => {
  it('turns interrupted work into retryable pages', () => {
    const serialized = serializeUploadQueue('course-id', 'session-id', true, [
      page('waiting', 0, 'waiting'),
      page('uploading', 1, 'uploading'),
    ]);

    expect(serialized).toMatchObject({
      courseId: 'course-id',
      importSessionId: 'session-id',
      processingStarted: true,
      pages: [
        { id: 'waiting', stage: 'waiting', pageId: null },
        {
          id: 'uploading',
          stage: 'failed',
          pageId: null,
          error: 'Der Upload wurde unterbrochen. Bitte erneut versuchen.',
        },
      ],
    });
    expect(serialized.pages[1]?.file).toBeInstanceOf(Blob);
  });

  it('restores page files and stored page identity', () => {
    const serialized = serializeUploadQueue('course-id', 'session-id', true, [
      page('extracting', 0, 'extracting'),
      page('ready', 1, 'ready'),
      page('failed', 2, 'failed'),
    ]);
    const restored = restoreUploadQueue(serialized);

    expect(restored).toMatchObject([
      { id: 'extracting', stage: 'failed', pageId: 'stored-extracting' },
      { id: 'ready', stage: 'ready', pageId: 'stored-ready' },
      {
        id: 'failed',
        stage: 'failed',
        pageId: 'stored-failed',
        error: 'Verarbeitung fehlgeschlagen.',
      },
    ]);
    expect(restored[0]?.file.name).toBe('page.jpg');
    expect(restored[0]?.file.type).toBe('image/jpeg');
    expect(restored[0]?.file.lastModified).toBe(expectedLastModified);
    for (const restoredPage of restored) {
      URL.revokeObjectURL(restoredPage.previewUrl);
    }
  });
});
