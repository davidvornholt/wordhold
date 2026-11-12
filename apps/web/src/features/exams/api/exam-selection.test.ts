import { describe, expect, it } from 'bun:test';
import { editedEntryIds } from './exam-selection';

describe('editedEntryIds', () => {
  it('adds new words once and keeps the ones already there', () => {
    expect(editedEntryIds(['a', 'b'], ['b', 'c', 'c'], [])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('leaves out a word removed from a unit added in the same edit', () => {
    expect(editedEntryIds(['a'], ['b', 'c'], ['c', 'x'])).toEqual(['a', 'b']);
  });
});
