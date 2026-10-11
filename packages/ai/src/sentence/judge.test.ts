import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { sentenceJudgePrompt } from './judge';
import { isSentenceCorrect, SentenceVerdict } from './judge-schema';

const lawyer = {
  targetLanguage: 'Spanish',
  sentence: 'Meine Schwester arbeitet als Anwältin in Madrid.',
  reference: 'Mi hermana trabaja como abogada en Madrid.',
  word: { target: 'el/la abogado/-a', german: 'der Anwalt / die Anwältin' },
} as const;

const representativePromptCharacterBudget = 1500;

describe('sentenceJudgePrompt', () => {
  it('names the answer language and sends every field as data', () => {
    const prompt = sentenceJudgePrompt({
      ...lawyer,
      givenAnswer: 'Mi hermana trabaja de abogada en Madrid.',
    });
    expect(prompt).toContain("learner's Spanish translation");
    expect(prompt).toContain(
      '"sentence":"Meine Schwester arbeitet als Anwältin in Madrid."',
    );
    expect(prompt).toContain(
      '"reference":"Mi hermana trabaja como abogada en Madrid."',
    );
    expect(prompt).toContain(
      '"word":{"target":"el/la abogado/-a","german":"der Anwalt / die Anwältin"}',
    );
    expect(prompt).toContain(
      '"answer":"Mi hermana trabaja de abogada en Madrid."',
    );
    expect(prompt.length).toBeLessThan(representativePromptCharacterBudget);
  });

  it('treats the reference as one translation among several', () => {
    expect(sentenceJudgePrompt({ ...lawyer, givenAnswer: '' })).toContain(
      'not the only one',
    );
  });

  it('counts case as spelling', () => {
    expect(sentenceJudgePrompt({ ...lawyer, givenAnswer: '' })).toContain(
      'spelledCorrectly judge the answer itself, case included',
    );
  });
});

describe('SentenceVerdict', () => {
  const decode = Schema.decodeUnknownSync(SentenceVerdict);
  const passing = {
    meaningKept: true,
    grammatical: true,
    spelledCorrectly: true,
    wordUsed: true,
    correction: null,
    explanation: 'Richtig.',
  } as const;

  it('counts a translation as correct only when every finding passes', () => {
    expect(isSentenceCorrect(decode(passing))).toBe(true);
    for (const finding of [
      'meaningKept',
      'grammatical',
      'spelledCorrectly',
      'wordUsed',
    ] as const) {
      expect(isSentenceCorrect(decode({ ...passing, [finding]: false }))).toBe(
        false,
      );
    }
  });

  it('keeps the correction of a faulted answer', () => {
    const verdict = decode({
      ...passing,
      grammatical: false,
      correction: 'Mi hermana trabaja como abogada en Madrid.',
      explanation: "Die Anwältin ist weiblich: 'abogada'.",
    });
    expect(verdict.correction).toBe(
      'Mi hermana trabaja como abogada en Madrid.',
    );
  });
});
