import { describe, expect, it } from 'bun:test';
import {
  maximumEntriesPerPage,
  maximumEntryTextLength,
  maximumExampleLength,
  maximumGrammarFieldLength,
  maximumIrregularForms,
  maximumUnitNameLength,
} from '@wordhold/ai/extraction/schema';
import { decodeImportPayload } from './import-payload';

const pageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';
const unit = { kind: 'new', name: 'Unité 3' } as const;
const validEntry = {
  unit,
  targetText: 'souvenir',
  nativeText: 'Erinnerung',
} as const;
const over = (maximum: number): string => 'x'.repeat(maximum + 1);

describe('decodeImportPayload', () => {
  it.each([
    {
      pageId,
      entries: [{ ...validEntry, targetText: over(maximumEntryTextLength) }],
    },
    {
      pageId,
      entries: [{ ...validEntry, nativeText: over(maximumEntryTextLength) }],
    },
    {
      pageId,
      entries: [{ ...validEntry, example: over(maximumExampleLength) }],
    },
    {
      pageId,
      entries: [
        {
          ...validEntry,
          grammar: { _tag: 'other', note: over(maximumGrammarFieldLength) },
        },
      ],
    },
    {
      pageId,
      entries: [
        {
          ...validEntry,
          grammar: {
            _tag: 'verb',
            irregularForms: Array.from(
              { length: maximumIrregularForms + 1 },
              () => 'form',
            ),
          },
        },
      ],
    },
    {
      pageId,
      entries: Array.from(
        { length: maximumEntriesPerPage + 1 },
        () => validEntry,
      ),
    },
  ])('rejects an over-limit verified payload before side effects', (input) => {
    let writes = 0;
    let providerCalls = 0;
    const invoke = () => {
      decodeImportPayload(input);
      writes += 1;
      providerCalls += 1;
    };
    expect(invoke).toThrow();
    expect(writes).toBe(0);
    expect(providerCalls).toBe(0);
  });

  it('files each entry into the selected unit', () => {
    const decoded = decodeImportPayload({
      pageId,
      entries: [
        {
          ...validEntry,
          unit: { kind: 'existing', unitId: pageId },
        },
      ],
    });

    expect(decoded.entries[0]?.unit).toEqual({
      kind: 'existing',
      unitId: pageId,
    });
  });

  it('trims the name of a unit being started', () => {
    const decoded = decodeImportPayload({
      pageId,
      entries: [{ ...validEntry, unit: { kind: 'new', name: '  Unité 4  ' } }],
    });

    expect(decoded.entries[0]?.unit).toEqual({
      kind: 'new',
      name: 'Unité 4',
    });
  });

  it.each([
    { kind: 'new', name: '   ' },
    { kind: 'new', name: over(maximumUnitNameLength) },
    { kind: 'existing', unitId: 'not-a-uuid' },
  ])('refuses an unusable unit selection', (selection) => {
    expect(() =>
      decodeImportPayload({
        pageId,
        entries: [{ ...validEntry, unit: selection }],
      }),
    ).toThrow();
  });

  it('carries an explicit duplicate exception through decoding', () => {
    const decoded = decodeImportPayload({
      pageId,
      entries: [{ ...validEntry, duplicateException: true }],
    });

    expect(decoded.entries[0]?.duplicateException).toBe(true);
  });

  it('refuses a duplicate exception that is not the literal true', () => {
    expect(() =>
      decodeImportPayload({
        pageId,
        entries: [{ ...validEntry, duplicateException: false }],
      }),
    ).toThrow();
  });
});
