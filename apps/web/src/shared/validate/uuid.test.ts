import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { Uuid } from './uuid';

const isUuid = Schema.is(Uuid);
const valid = 'd9428888-122b-41e1-b85c-61cd3cbb3210';

describe('Uuid', () => {
  it('accepts version 4 UUIDs like the ones wordhold generates', () => {
    expect(isUuid(valid)).toBe(true);
    expect(isUuid(valid.toUpperCase())).toBe(true);
    expect(isUuid(crypto.randomUUID())).toBe(true);
  });

  it.each([
    ['version 0', 'd9428888-122b-01e1-b85c-61cd3cbb3210'],
    ['version 9', 'd9428888-122b-91e1-b85c-61cd3cbb3210'],
    ['NCS variant', 'd9428888-122b-41e1-785c-61cd3cbb3210'],
    ['Microsoft variant', 'd9428888-122b-41e1-c85c-61cd3cbb3210'],
    ['shape', 'd9428888122b41e1b85c61cd3cbb3210'],
  ])('rejects an ID with the wrong %s', (_, id) => {
    expect(isUuid(id)).toBe(false);
  });
});
