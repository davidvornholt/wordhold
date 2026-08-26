import { describe, expect, it } from 'bun:test';
import {
  maximumEntriesPerPage,
  maximumEntryTextLength,
  maximumExampleLength,
  maximumGrammarFieldLength,
  maximumIrregularForms,
  maximumLabelLength,
} from '@wordhold/ai/extraction/schema';
import { decodeImportPayload, maximumUnitNameLength } from './import-payload';

const pageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';
const unit = { kind: 'new', name: 'Unité 3' } as const;
const validEntry = {
  type: 'word',
  targetText: 'souvenir',
  nativeText: 'Erinnerung',
} as const;
const over = (maximum: number): string => 'x'.repeat(maximum + 1);

describe('decodeImportPayload', () => {
  it.each([
    { pageId, unit, label: over(maximumLabelLength), entries: [validEntry] },
    {
      pageId,
      unit,
      entries: [{ ...validEntry, targetText: over(maximumEntryTextLength) }],
    },
    {
      pageId,
      unit,
      entries: [{ ...validEntry, nativeText: over(maximumEntryTextLength) }],
    },
    {
      pageId,
      unit,
      entries: [{ ...validEntry, example: over(maximumExampleLength) }],
    },
    {
      pageId,
      unit,
      entries: [
        {
          ...validEntry,
          grammar: { _tag: 'other', note: over(maximumGrammarFieldLength) },
        },
      ],
    },
    {
      pageId,
      unit,
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
      unit,
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

  it('files entries into a unit that already exists', () => {
    const decoded = decodeImportPayload({
      pageId,
      unit: { kind: 'existing', unitId: pageId },
      entries: [validEntry],
    });

    expect(decoded.unit).toEqual({ kind: 'existing', unitId: pageId });
  });

  it('trims the name of a unit being started', () => {
    const decoded = decodeImportPayload({
      pageId,
      unit: { kind: 'new', name: '  Unité 4  ' },
      entries: [validEntry],
    });

    expect(decoded.unit).toEqual({ kind: 'new', name: 'Unité 4' });
  });

  it.each([
    { kind: 'new', name: '   ' },
    { kind: 'new', name: over(maximumUnitNameLength) },
    { kind: 'existing', unitId: 'not-a-uuid' },
  ])('refuses an unusable unit selection', (selection) => {
    expect(() =>
      decodeImportPayload({ pageId, unit: selection, entries: [validEntry] }),
    ).toThrow();
  });
});
