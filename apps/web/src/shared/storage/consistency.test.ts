import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  orphanedDataFiles,
  orphanGracePeriodMs,
  persistFileReference,
  stagedPath,
} from './consistency';

const nowMs = 2 * orphanGracePeriodMs;
const pagePath = 'pages/d9428888-122b-41e1-b85c-61cd3cbb3210.jpg';
const suffixedPagePath =
  'pages/d9428888-122b-41e1-b85c-61cd3cbb3210-d9428888-122b-41e1-b85c-61cd3cbb3212.webp';
const audioPath = 'audio/d9428888-122b-41e1-b85c-61cd3cbb3210-amy.mp3';
const stageId = '5f0c3b7e-8d1a-4c2b-9e6f-0a1b2c3d4e5f';

describe('persistFileReference', () => {
  it('removes a file when its database reference fails', async () => {
    const actions: Array<string> = [];
    await expect(
      Effect.runPromise(
        persistFileReference({
          write: Effect.sync(() => {
            actions.push('write');
          }),
          persistReference: Effect.sync(() => {
            actions.push('persist');
          }).pipe(Effect.andThen(Effect.fail(new Error('insert failed')))),
          remove: Effect.sync(() => {
            actions.push('remove');
          }),
        }),
      ),
    ).rejects.toThrow('insert failed');
    expect(actions).toEqual(['write', 'persist', 'remove']);
  });
});

describe('orphanedDataFiles', () => {
  it('selects only old generated files without database references', () => {
    const orphaned = orphanedDataFiles(
      [
        { relativePath: pagePath, modifiedAtMs: 0 },
        { relativePath: suffixedPagePath, modifiedAtMs: 0 },
        { relativePath: audioPath, modifiedAtMs: 0 },
        { relativePath: 'pages/notes.txt', modifiedAtMs: 0 },
        {
          relativePath: 'pages/d9428888-122b-41e1-b85c-61cd3cbb3211.png',
          modifiedAtMs: nowMs,
        },
      ],
      new Set([audioPath]),
      nowMs,
    );
    expect(orphaned).toEqual(
      expect.arrayContaining([pagePath, suffixedPagePath]),
    );
    expect(orphaned).toHaveLength(2);
  });

  it('selects old staged copies that were never renamed into place', () => {
    const stagedPagePath = stagedPath(pagePath, stageId);
    const orphaned = orphanedDataFiles(
      [
        { relativePath: stagedPagePath, modifiedAtMs: 0 },
        {
          relativePath: stagedPath(audioPath, stageId),
          modifiedAtMs: nowMs,
        },
        {
          relativePath: stagedPath('pages/notes.txt', stageId),
          modifiedAtMs: 0,
        },
      ],
      new Set([pagePath]),
      nowMs,
    );
    expect(orphaned).toEqual([stagedPagePath]);
  });
});
