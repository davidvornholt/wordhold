import { describe, expect, it } from 'bun:test';
import {
  maximumTextbookReadings,
  textbookReadings,
} from './textbook-notation';

describe('textbookReadings', () => {
  it('expands optional textbook fragments without changing their words', () => {
    expect(textbookReadings('to look (at)')).toEqual([
      'to look at',
      'to look',
      'to look (at)',
    ]);
  });

  it('falls back to the exact display after the expansion bound', () => {
    const notation = `root ${'(a)'.repeat(maximumTextbookReadings)}`;
    expect(textbookReadings(notation)).toEqual([notation]);
  });

  it('does not interpret malformed or nested notation', () => {
    expect(textbookReadings('root ((a))')).toEqual(['root ((a))']);
  });
});
