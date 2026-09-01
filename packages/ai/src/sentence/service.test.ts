import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { maximumExampleLength } from '../extraction/schema';
import {
  SentenceBatch,
  SentenceTranslation,
  sentenceTranslationPrompt,
} from './service';

const decode = Schema.decodeUnknownSync(SentenceBatch);

describe('SentenceBatch', () => {
  it('trims usable generated sentences and translations', () => {
    expect(
      decode({
        sentences: [{ target: '  Je lis.  ', native: '  Ich lese.  ' }],
      }),
    ).toEqual({
      sentences: [{ target: 'Je lis.', native: 'Ich lese.' }],
    });
  });

  it('rejects empty or over-limit model output', () => {
    expect(() =>
      decode({ sentences: [{ target: ' ', native: 'Ich lese.' }] }),
    ).toThrow();
    expect(() =>
      decode({
        sentences: [
          { target: 'x'.repeat(maximumExampleLength + 1), native: 'Text' },
        ],
      }),
    ).toThrow();
  });
});

describe('sentence translation', () => {
  it('keeps a textbook sentence intact while requesting its German translation', () => {
    const target =
      "Si tu manges de la viande, ton alimentation n'est pas végétarienne.";
    const prompt = sentenceTranslationPrompt(target, 'French');
    expect(prompt).toContain(target);
    expect(prompt).toContain('German');
    expect(
      Schema.decodeUnknownSync(SentenceTranslation)({
        native:
          '  Wenn du Fleisch isst, ist deine Ernährung nicht vegetarisch.  ',
      }),
    ).toEqual({
      native: 'Wenn du Fleisch isst, ist deine Ernährung nicht vegetarisch.',
    });
  });
});
