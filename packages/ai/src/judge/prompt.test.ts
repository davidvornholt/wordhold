import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { JudgeVerdict } from './schema';
import { judgePrompt } from './service';

describe('judgePrompt', () => {
  it('names the answer language from the direction', () => {
    const base = {
      targetLanguage: 'French',
      prompt: 'die Erinnerung',
      expectedAnswers: ['le souvenir'],
      givenAnswer: 'la mémoire',
      entryType: 'word',
    } as const;
    expect(judgePrompt({ ...base, direction: 'to_target' })).toContain(
      'into French',
    );
    expect(judgePrompt({ ...base, direction: 'to_native' })).toContain(
      'into German',
    );
  });

  it('quotes every expected answer and the given answer', () => {
    const prompt = judgePrompt({
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'die Freiheit',
      expectedAnswers: ['freedom', 'liberty'],
      givenAnswer: 'fredom',
      entryType: 'word',
    });
    expect(prompt).toContain('"freedom", "liberty"');
    expect(prompt).toContain('"fredom"');
  });
});

describe('JudgeVerdict schema', () => {
  const completeVerdict = {
    correct: true,
    acceptAsAlternative: true,
    meaning: { ok: true },
    grammar: { ok: true },
    idiomaticity: { ok: true },
    spelling: { ok: true },
    intendedConstruction: { ok: true },
    explanation: 'Passt.',
  } as const;

  it('decodes a complete verdict', () => {
    const verdict = Schema.decodeUnknownSync(JudgeVerdict)({
      correct: false,
      acceptAsAlternative: false,
      meaning: { ok: true },
      grammar: { ok: true },
      idiomaticity: { ok: false, note: 'ungebräuchlich' },
      spelling: { ok: true },
      intendedConstruction: { ok: false },
      explanation: 'Fast! „le souvenir“ ist hier das gesuchte Wort.',
    });
    expect(verdict.correct).toBe(false);
    expect(verdict.idiomaticity.note).toBe('ungebräuchlich');
  });

  it('accepts a fully correct alternative', () => {
    expect(
      Schema.decodeUnknownSync(JudgeVerdict)(completeVerdict)
        .acceptAsAlternative,
    ).toBe(true);
  });

  it('rejects an alternative marked both accepted and incorrect', () => {
    expect(() =>
      Schema.decodeUnknownSync(JudgeVerdict)({
        ...completeVerdict,
        correct: false,
      }),
    ).toThrow();
  });

  it('rejects a correct alternative with a flawed grading dimension', () => {
    expect(() =>
      Schema.decodeUnknownSync(JudgeVerdict)({
        ...completeVerdict,
        spelling: { ok: false, note: 'Tippfehler' },
      }),
    ).toThrow();
  });
});
