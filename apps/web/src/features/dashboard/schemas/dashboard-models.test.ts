import { describe, expect, it } from 'bun:test';
import { hasAvailablePractice } from './dashboard-models';

describe('hasAvailablePractice', () => {
  it('rejects a missing or empty queue', () => {
    expect(hasAvailablePractice(undefined)).toBe(false);
    expect(hasAvailablePractice({ due: 0, fresh: 0 })).toBe(false);
  });

  it('accepts either due or fresh cards', () => {
    expect(hasAvailablePractice({ due: 1, fresh: 0 })).toBe(true);
    expect(hasAvailablePractice({ due: 0, fresh: 1 })).toBe(true);
  });
});
