import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { maximumExampleLength } from '../extraction/schema';
import {
  SentenceBatch,
  SentenceTranslation,
  sentenceTranslationPrompt,
  WordTranslation,
  wordTranslationPrompt,
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

describe('word translation', () => {
  it('asks for the missing side in textbook form and names the unit', () => {
    const toGerman = wordTranslationPrompt({
      text: 'memory',
      given: 'target',
      targetLanguage: 'English',
      context: 'Unit 3 – Holidays',
    });
    expect(toGerman).toContain('German translation of the English');
    expect(toGerman).toContain('"memory"');
    expect(toGerman).toContain('Unit 3 – Holidays');
    const toTarget = wordTranslationPrompt({
      text: 'die Reise',
      given: 'native',
      targetLanguage: 'French',
    });
    expect(toTarget).toContain('French translation of the German');
    expect(toTarget).not.toContain('unit');
    expect(
      Schema.decodeUnknownSync(WordTranslation)({ translation: ' le voyage ' }),
    ).toEqual({ translation: 'le voyage' });
    expect(() =>
      Schema.decodeUnknownSync(WordTranslation)({ translation: '  ' }),
    ).toThrow();
  });
});
