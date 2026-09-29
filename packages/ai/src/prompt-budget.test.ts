import { describe, expect, it } from 'bun:test';
import { definitionJudgePrompt } from './definition/judge';
import { definitionPrompt, keyPointPrompt } from './definition/writer';
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
const definitionJudgeInstructionBudget = 800;
const definitionInstructionBudget = 400;

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

  it('keeps definition instructions compact', () => {
    expect(
      definitionJudgePrompt({
        term: '',
        definition: '',
        keyPoints: [],
        givenAnswer: '',
      }).length,
    ).toBeLessThanOrEqual(definitionJudgeInstructionBudget);
    expect(
      keyPointPrompt({ term: '', definition: '' }).length,
    ).toBeLessThanOrEqual(definitionInstructionBudget);
    expect(
      definitionPrompt({ term: '', subject: '' }).length,
    ).toBeLessThanOrEqual(definitionInstructionBudget);
  });
});
