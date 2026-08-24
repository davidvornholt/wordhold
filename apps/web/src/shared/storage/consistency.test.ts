import { describe, expect, it } from 'bun:test';
import {
  orphanedDataFiles,
  orphanGracePeriodMs,
  persistFileReference,
} from './consistency';

const nowMs = 2 * orphanGracePeriodMs;
const pagePath = 'pages/d9428888-122b-41e1-b85c-61cd3cbb3210.jpg';
const audioPath = 'audio/d9428888-122b-41e1-b85c-61cd3cbb3210-amy.mp3';

describe('persistFileReference', () => {
  it('removes a file when its database reference fails', async () => {
    const actions: Array<string> = [];
    await expect(
      persistFileReference({
        write: () => {
          actions.push('write');
          return Promise.resolve();
        },
        persistReference: () => {
          actions.push('persist');
          return Promise.reject(new Error('insert failed'));
        },
        remove: () => {
          actions.push('remove');
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow('insert failed');
    expect(actions).toEqual(['write', 'persist', 'remove']);
  });
});

describe('orphanedDataFiles', () => {
  it('selects only old generated files without database references', () => {
    expect(
      orphanedDataFiles(
        [
          { relativePath: pagePath, modifiedAtMs: 0 },
          { relativePath: audioPath, modifiedAtMs: 0 },
          { relativePath: 'pages/notes.txt', modifiedAtMs: 0 },
          {
            relativePath: 'pages/d9428888-122b-41e1-b85c-61cd3cbb3211.png',
            modifiedAtMs: nowMs,
          },
        ],
        new Set([audioPath]),
        nowMs,
      ),
    ).toEqual([pagePath]);
  });
});
