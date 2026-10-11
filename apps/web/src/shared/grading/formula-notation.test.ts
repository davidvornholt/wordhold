import { describe, expect, it } from 'bun:test';
import { isSameReading } from './formula-notation';

describe('isSameReading', () => {
  it('reads a digit or sign on the line as a lowered or raised one', () => {
    expect(isSameReading('H₂O', 'H2O')).toBe(true);
    expect(isSameReading('SO42-', 'SO₄²⁻')).toBe(true);
    expect(isSameReading('Na⁺', 'Na+')).toBe(true);
    expect(isSameReading('x₊', 'x+')).toBe(true);
  });

  it('takes a raised or lowered mark as written', () => {
    expect(isSameReading('H₂O', 'H²O')).toBe(false);
    expect(isSameReading('Na⁺', 'Na⁻')).toBe(false);
    expect(isSameReading('Na⁺', 'Na')).toBe(false);
  });

  it('compares everything else exactly', () => {
    expect(isSameReading('der Weg', 'der Weg')).toBe(true);
    expect(isSameReading('der Weg', 'der weg')).toBe(false);
    expect(isSameReading('H2', 'H3')).toBe(false);
  });
});
