import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import {
  AddEntryPayloadSchema,
  EditEntryPayloadSchema,
  entryTextLength,
} from './api';

const decodeAdd = Schema.decodeUnknownSync(AddEntryPayloadSchema);
const isEdit = Schema.is(EditEntryPayloadSchema);

describe('the request bodies', () => {
  it('trims the texts of a new entry', () => {
    expect(
      decodeAdd({ targetText: ' la casa ', nativeText: 'das Haus\n' }),
    ).toEqual({ targetText: 'la casa', nativeText: 'das Haus' });
  });

  it('rejects an empty or overlong word', () => {
    expect(() => decodeAdd({ targetText: '  ', nativeText: 'x' })).toThrow();
    expect(() =>
      decodeAdd({
        targetText: 'x'.repeat(entryTextLength + 1),
        nativeText: 'x',
      }),
    ).toThrow();
  });

  it('lets an edit name only what changes, and remove the example', () => {
    expect(isEdit({ nativeText: 'das Haus' })).toBe(true);
    expect(isEdit({ example: null })).toBe(true);
    expect(isEdit({ example: { targetText: 'Mi casa es tu casa.' } })).toBe(
      true,
    );
    expect(isEdit({ targetText: '' })).toBe(false);
  });

  it('lets an edit replace or remove synonyms and antonyms', () => {
    expect(isEdit({ synonyms: ['le copain'], antonyms: [] })).toBe(true);
    expect(isEdit({ synonyms: [' '] })).toBe(false);
  });
});
