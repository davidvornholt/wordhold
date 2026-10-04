import { describe, expect, it } from 'bun:test';
import { germanSoundKey } from './german-sound';

describe('germanSoundKey', () => {
  it('gives spellings of the same sound one key', () => {
    for (const [left, right] of [
      ['seid', 'seit'],
      ['wahr', 'war'],
      ['mahl', 'mal'],
      ['tod', 'tot'],
      ['dass', 'das'],
      ['stadt', 'statt'],
      ['wieder', 'wider'],
      ['viel', 'fiel'],
      ['leib', 'laib'],
      ['mehr', 'meer'],
      ['aehre', 'ehre'],
      ['philipper', 'filipper'],
    ] as const) {
      expect(germanSoundKey(left)).toBe(germanSoundKey(right));
    }
  });

  it('keeps words apart that sound different', () => {
    for (const [left, right] of [
      ['dem', 'den'],
      ['der', 'dir'],
      ['ein', 'eine'],
      ['das', 'des'],
      ['im', 'in'],
      ['hirte', 'herde'],
      ['weg', 'weh'],
      ['nah', 'nach'],
    ] as const) {
      expect(germanSoundKey(left)).not.toBe(germanSoundKey(right));
    }
  });
});
