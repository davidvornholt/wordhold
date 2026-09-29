import { describe, expect, it } from 'bun:test';
import {
  maximumKeyPointLength,
  maximumKeyPoints,
} from '@wordhold/ai/definition/schema';
import { parseKeyPointLines } from './key-point-lines';

describe('parseKeyPointLines', () => {
  it('takes one key point per line and drops blank lines and repeats', () => {
    expect(
      parseKeyPointLines(
        '  senkt die Aktivierungsenergie \n\n\r\nwird nicht verbraucht\nwird nicht verbraucht',
      ),
    ).toEqual({
      kind: 'valid',
      keyPoints: ['senkt die Aktivierungsenergie', 'wird nicht verbraucht'],
    });
  });

  it('refuses no key point, too many and one that is too long', () => {
    expect(parseKeyPointLines(' \n ').kind).toBe('invalid');
    expect(
      parseKeyPointLines(
        Array.from(
          { length: maximumKeyPoints + 1 },
          (_, index) => `Punkt ${index}`,
        ).join('\n'),
      ).kind,
    ).toBe('invalid');
    expect(parseKeyPointLines('x'.repeat(maximumKeyPointLength + 1)).kind).toBe(
      'invalid',
    );
  });
});
