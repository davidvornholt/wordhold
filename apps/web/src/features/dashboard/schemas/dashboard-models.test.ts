import { describe, expect, it } from 'bun:test';
import { hasAvailablePractice } from './dashboard-models';

describe('hasAvailablePractice', () => {
  it('rejects a missing or empty queue', () => {
    expect(hasAvailablePractice(undefined)).toBe(false);
    expect(hasAvailablePractice({ ready: 0 })).toBe(false);
  });

  it('accepts a non-empty next section', () => {
    expect(hasAvailablePractice({ ready: 1 })).toBe(true);
  });
});
