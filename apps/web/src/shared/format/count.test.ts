import { describe, expect, it } from 'bun:test';
import { countNoun } from './count';

describe('countNoun', () => {
  it('uses the singular for exactly one', () => {
    expect(countNoun(1, 'Karte', 'Karten')).toBe('1 Karte');
  });

  it('uses the plural for zero and many', () => {
    expect(countNoun(0, 'Karte', 'Karten')).toBe('0 Karten');
    expect(countNoun(2, 'Vokabel', 'Vokabeln')).toBe('2 Vokabeln');
  });
});
