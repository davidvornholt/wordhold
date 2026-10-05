import { describe, expect, it } from 'bun:test';
import { numberWordKey, numberWordStems } from './german-numbers';

describe('numberWordStems', () => {
  it('writes out counts and ordinals', () => {
    expect(numberWordStems('1')).toEqual(['ein', 'erst']);
    expect(numberWordStems('3')).toEqual(['drei', 'dritt']);
    expect(numberWordStems('7')).toEqual(['sieben', 'siebt', 'siebent']);
    expect(numberWordStems('8')).toEqual(['acht', 'acht']);
    expect(numberWordStems('12')).toEqual(['zwölf', 'zwölft']);
    expect(numberWordStems('40')).toEqual(['vierzig', 'vierzigst']);
    expect(numberWordStems('0')).toEqual(['null', 'nullst']);
  });

  it('builds compound numbers the way German writes them', () => {
    expect(numberWordStems('21')).toEqual(['einundzwanzig', 'einundzwanzigst']);
    expect(numberWordStems('101')).toEqual(['einhundertein', 'einhunderterst']);
    expect(numberWordStems('153')[0]).toBe('einhundertdreiundfünfzig');
    expect(numberWordStems('1000')[0]).toBe('eintausend');
    expect(numberWordStems('144000')[0]).toBe(
      'einhundertvierundvierzigtausend',
    );
    expect(numberWordStems('999999')[0]).toBe(
      'neunhundertneunundneunzigtausendneunhundertneunundneunzig',
    );
  });

  it('leaves out what is not a plain number below a million', () => {
    expect(numberWordStems('1000000')).toEqual([]);
    expect(numberWordStems('007')).toEqual([]);
    expect(numberWordStems('zwölf')).toEqual([]);
  });
});

describe('numberWordKey', () => {
  it('drops the "ein" a hundred or a thousand may start with', () => {
    expect(numberWordKey('einhundertvierundvierzigtausend')).toBe(
      'hundertvierundvierzigtausend',
    );
    expect(numberWordKey('zweitausendeinhundert')).toBe('zweitausendhundert');
    expect(numberWordKey('hunderteintausend')).toBe('hunderteintausend');
    expect(numberWordKey('einundzwanzig')).toBe('einundzwanzig');
  });

  it('drops the "und" older translations put after a hundred or a thousand', () => {
    expect(numberWordKey('hundertundzwanzig')).toBe('hundertzwanzig');
    expect(numberWordKey('tausendundeine')).toBe('tausendeine');
    expect(numberWordKey('vierundvierzig')).toBe('vierundvierzig');
    expect(numberWordKey('hundertundvierundvierzigtausend')).toBe(
      'hundertvierundvierzigtausend',
    );
  });
});
