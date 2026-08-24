import { describe, expect, it } from 'bun:test';
import {
  maximumEntriesPerPage,
  maximumEntryTextLength,
  maximumExampleLength,
  maximumGrammarFieldLength,
  maximumIrregularForms,
  maximumLabelLength,
} from '@wordhold/ai/extraction/schema';
import { decodeImportPayload } from './schema';

const pageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';
const validEntry = {
  type: 'word',
  targetText: 'souvenir',
  nativeText: 'Erinnerung',
} as const;
const over = (maximum: number): string => 'x'.repeat(maximum + 1);

describe('decodeImportPayload', () => {
  it.each([
    { pageId, label: over(maximumLabelLength), entries: [validEntry] },
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
});
