import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import {
  ExtractedPage,
  maximumEntriesPerPage,
  maximumEntryTextLength,
} from './schema';

const decode = Schema.decodeUnknownSync(ExtractedPage);

describe('ExtractedPage', () => {
  it('decodes a full page with grammar variants', () => {
    const page = decode({
      pageLabel: 'Unité 3, p. 87',
      overallConfidence: 0.95,
      entries: [
        {
          type: 'word',
          targetText: 'le souvenir',
          nativeText: 'die Erinnerung',
          grammar: { _tag: 'noun', gender: 'masculine', plural: 'souvenirs' },
          confidence: 0.98,
        },
        {
          type: 'expression',
          targetText: 'se souvenir de',
          nativeText: 'sich erinnern an',
          grammar: { _tag: 'verb', irregularForms: ['je me souviens'] },
          example: 'Je me souviens de mes vacances.',
          confidence: 0.9,
        },
      ],
    });
    expect(page.entries).toHaveLength(2);
    expect(page.entries[0]?.grammar?._tag).toBe('noun');
  });

  it('rejects confidence outside [0, 1]', () => {
    expect(() => decode({ overallConfidence: 1.2, entries: [] })).toThrow();
  });

  it('rejects unknown entry types', () => {
    expect(() =>
      decode({
        overallConfidence: 0.5,
        entries: [
          {
            type: 'paragraph',
            targetText: 'x',
            nativeText: 'y',
            confidence: 0.5,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects more entries than one verification page can accept', () => {
    expect(() =>
      decode({
        overallConfidence: 1,
        entries: Array.from({ length: maximumEntriesPerPage + 1 }, () => ({
          type: 'word',
          targetText: 'x',
          nativeText: 'y',
          confidence: 1,
        })),
      }),
    ).toThrow();
  });

  it('rejects extracted fields over the verified-field limit', () => {
    expect(() =>
      decode({
        overallConfidence: 1,
        entries: [
          {
            type: 'word',
            targetText: 'x'.repeat(maximumEntryTextLength + 1),
            nativeText: 'y',
            confidence: 1,
          },
        ],
      }),
    ).toThrow();
  });
});
