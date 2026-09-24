import { describe, expect, it } from 'bun:test';
import { extractionPrompt } from './extraction/service';
import {
  sentencePrompt,
  sentenceTranslationPrompt,
  wordTranslationPrompt,
} from './sentence/service';

// Limit instruction overhead independently of learner or textbook text.
// Character budgets are deterministic across provider tokenizer versions.
const extractionInstructionBudget = 550;
const sentenceInstructionBudget = 300;
const translationInstructionBudget = 450;

describe('prompt instruction budgets', () => {
  it('keeps page extraction instructions compact', () => {
    expect(extractionPrompt('').length).toBeLessThanOrEqual(
      extractionInstructionBudget,
    );
  });

  it('keeps sentence and translation instructions compact', () => {
    expect(
      sentencePrompt({
        targetText: '',
        nativeText: '',
        targetLanguage: '',
        count: 1,
      }).length,
    ).toBeLessThanOrEqual(sentenceInstructionBudget);
    expect(sentenceTranslationPrompt('', '').length).toBeLessThanOrEqual(
      translationInstructionBudget,
    );
    expect(
      wordTranslationPrompt({ text: '', given: 'native', targetLanguage: '' })
        .length,
    ).toBeLessThanOrEqual(translationInstructionBudget);
  });
});
