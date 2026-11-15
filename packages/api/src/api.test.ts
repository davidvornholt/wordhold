import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import {
  AddEntryPayloadSchema,
  EditEntryPayloadSchema,
  entryTextLength,
  MoveEntriesPayloadSchema,
} from './api';

const decodeAdd = Schema.decodeUnknownSync(AddEntryPayloadSchema);
const isEdit = Schema.is(EditEntryPayloadSchema);
const isMove = Schema.is(MoveEntriesPayloadSchema);

const word = '5f0e9d8c-7b6a-4c5d-8e9f-0a1b2c3d4e5f';
const place = '0b6a4f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

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

  it('lets an example say whether AI wrote it', () => {
    const example = { targetText: 'Mi casa es tu casa.' };
    expect(isEdit({ example: { ...example, source: 'generated' } })).toBe(true);
    expect(isEdit({ example: { ...example, source: 'ai' } })).toBe(false);
  });

  it('lets an edit replace or remove synonyms and antonyms', () => {
    expect(isEdit({ synonyms: ['le copain'], antonyms: [] })).toBe(true);
    expect(isEdit({ synonyms: [' '] })).toBe(false);
  });

  it('moves words only to a unit or a book it names', () => {
    expect(isMove({ entryIds: [word], unitId: place })).toBe(true);
    expect(isMove({ entryIds: [word], bookId: place })).toBe(true);
    expect(isMove({ entryIds: [word] })).toBe(false);
    expect(isMove({ entryIds: [], unitId: place })).toBe(false);
    expect(isMove({ entryIds: [word, word], unitId: place })).toBe(false);
  });
});
