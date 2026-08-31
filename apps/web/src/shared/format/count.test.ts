import { describe, expect, test } from 'bun:test';
import { countNoun } from './count';

describe('countNoun', () => {
  test('uses the singular for exactly one', () => {
    expect(countNoun(1, 'Karte', 'Karten')).toBe('1 Karte');
  });

  test('uses the plural for zero and many', () => {
    expect(countNoun(0, 'Karte', 'Karten')).toBe('0 Karten');
    expect(countNoun(21, 'Vokabel', 'Vokabeln')).toBe('21 Vokabeln');
  });
});
