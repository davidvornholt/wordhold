import { describe, expect, it } from 'bun:test';
import { removeIfPresent } from './server';

describe('removeIfPresent', () => {
  it('treats concurrent cleanup of one file as idempotent', async () => {
    let present = true;
    const remove = (): Promise<void> => {
      if (!present) {
        const error = Object.assign(new Error('already removed'), {
          code: 'ENOENT',
        });
        return Promise.reject(error);
      }
      present = false;
      return Promise.resolve();
    };

    await Promise.all([removeIfPresent(remove), removeIfPresent(remove)]);
    expect(present).toBe(false);
  });
});
