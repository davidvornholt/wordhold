import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { isAcceptedAlternative, isOtherWording, JudgeVerdict } from './schema';
import { enforceTargetSpelling, judgePrompt } from './service';

const representativePromptCharacterBudget = 1500;

describe('judgePrompt', () => {
  it('names the answer language from the direction', () => {
    const base = {
      targetLanguage: 'French',
      prompt: 'die Erinnerung',
      expectedAnswers: ['le souvenir'],
      givenAnswer: 'la mémoire',
    } as const;
    expect(judgePrompt({ ...base, direction: 'to_target' })).toContain(
      'into French',
    );
    expect(judgePrompt({ ...base, direction: 'to_native' })).toContain(
      'into German',
    );
  });

  // A vocabulary test marks a synonym of the textbook word wrong, so only
  // notation may differ from it.
  it('accepts only the textbook wording into the target language', () => {
    const prompt = judgePrompt({
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'der Rechtsanwalt, die Rechtsanwältin',
      expectedAnswers: ['el/la abogado/-a'],
      givenAnswer: 'el abogado / la abogada',
    });
    expect(prompt.length).toBeLessThan(representativePromptCharacterBudget);
    expect(prompt).toContain('accept only an expected answer');
    expect(prompt).toContain(
      'A synonym, paraphrase or regional variant is incorrect',
    );
    expect(prompt).toContain('expanded gender forms');
    expect(prompt).not.toContain('including synonyms');
  });

  it('accepts any valid translation into German', () => {
    const prompt = judgePrompt({
      direction: 'to_native',
      targetLanguage: 'Spanish',
      prompt: 'el ordenador',
      expectedAnswers: ['der Computer'],
      givenAnswer: 'der Rechner',
    });
    expect(prompt.length).toBeLessThan(representativePromptCharacterBudget);
    expect(prompt).toContain('including synonyms and natural paraphrases');
    expect(prompt).toContain('do not impose hidden meanings');
    expect(prompt).toContain('explicit in the shown task');
    expect(prompt).not.toContain('accept only an expected answer');
  });

  it('fails an answer capitalized against its language', () => {
    const prompt = judgePrompt({
      direction: 'to_native',
      targetLanguage: 'English',
      prompt: 'the path',
      expectedAnswers: ['der Weg'],
      givenAnswer: 'der weg',
    });
    expect(prompt).toContain('a lower-case German noun or English I');
    expect(prompt).toContain('fails spelling and makes the answer incorrect');
  });

  it('quotes every expected answer and the given answer', () => {
    const prompt = judgePrompt({
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'die Freiheit',
      expectedAnswers: ['freedom', 'liberty'],
      givenAnswer: 'fredom',
    });
    expect(prompt).toContain('"expected":["freedom","liberty"]');
    expect(prompt).toContain('"fredom"');
  });

  it('grades a synonym or antonym in the sense of its German meaning', () => {
    const base = {
      targetLanguage: 'English',
      prompt: 'hostile',
      meaning: 'feindselig',
      expectedAnswers: ['unfriendly', 'aggressive'],
      givenAnswer: 'antagonistic',
    } as const;
    const synonym = judgePrompt({ ...base, direction: 'to_synonym' });
    const antonym = judgePrompt({ ...base, direction: 'to_antonym' });

    expect(synonym).toContain(
      "Grade a learner's synonym of the shown English word",
    );
    expect(synonym).toContain('not only the expected answers');
    expect(synonym).toContain('Reject the shown word itself');
    expect(synonym).toContain(
      '{"word":"hostile","meaning":"feindselig","expected":["unfriendly","aggressive"],"answer":"antagonistic"}',
    );
    expect(antonym).toContain(
      "Grade a learner's antonym of the shown English word",
    );
    expect(antonym).toContain('Reject a bare negation');
    expect(antonym.length).toBeLessThan(representativePromptCharacterBudget);
  });

  // The feedback heading already says the answer was right, so a note on an
  // accepted answer must teach something about the difference.
  it('asks for a difference worth knowing instead of a bare confirmation', () => {
    const prompt = judgePrompt({
      direction: 'to_native',
      targetLanguage: 'Spanish',
      prompt: 'el curso',
      expectedAnswers: ['das Schuljahr'],
      givenAnswer: 'der Jahrgang',
    });
    expect(prompt).toContain('Write the explanation in German');
    expect(prompt).toContain('such as usage, register or region');
    expect(prompt).toContain('Otherwise use a null explanation');
    expect(prompt).toContain('never a bare confirmation');
  });
});

// Another wording that translates the whole task lets the learner try again;
// a partial one is an ordinary miss.
describe('judgePrompt for an answer in other wording', () => {
  const base = {
    targetLanguage: 'Spanish',
    prompt: 'sich auf etw. konzentrieren',
    expectedAnswers: ['enfocarse en algo'],
    givenAnswer: 'concentrarse en algo',
  } as const;
  const rule = 'set otherWording=true if it is complete';

  it('marks a complete translation into the target language', () => {
    expect(judgePrompt({ ...base, direction: 'to_target' })).toContain(rule);
  });

  it.each([
    ['into German', judgePrompt({ ...base, direction: 'to_native' })],
    [
      'for a synonym',
      judgePrompt({ ...base, direction: 'to_synonym', meaning: 'Fokus' }),
    ],
    [
      'for an antonym',
      judgePrompt({ ...base, direction: 'to_antonym', meaning: 'Fokus' }),
    ],
  ])('never marks one %s', (_direction, prompt) => {
    expect(prompt).not.toContain(rule);
    expect(prompt).toContain('Set otherWording=false.');
  });
});

describe('JudgeVerdict schema', () => {
  const completeVerdict = {
    correct: true,
    acceptAsAlternative: true,
    otherWording: false,
    meaning: { ok: true, note: null },
    grammar: { ok: true, note: null },
    idiomaticity: { ok: true, note: null },
    spelling: { ok: true, note: null },
    intendedConstruction: { ok: true, note: null },
    explanation: 'Passt.',
  } as const;

  it('decodes a complete verdict', () => {
    const verdict = Schema.decodeUnknownSync(JudgeVerdict)({
      correct: false,
      acceptAsAlternative: false,
      otherWording: true,
      meaning: { ok: true, note: null },
      grammar: { ok: true, note: null },
      idiomaticity: { ok: false, note: 'ungebräuchlich' },
      spelling: { ok: true, note: null },
      intendedConstruction: { ok: false, note: null },
      explanation: 'Fast! „le souvenir“ ist hier das gesuchte Wort.',
    });
    expect(verdict.correct).toBe(false);
    expect(verdict.otherWording).toBe(true);
    expect(verdict.idiomaticity.note).toBe('ungebräuchlich');
  });

  // A verdict cached before the field existed is never read as a rejection
  // the learner may not retry.
  it('refuses a verdict without otherWording', () => {
    const { otherWording: _omitted, ...withoutOtherWording } = completeVerdict;

    expect(() =>
      Schema.decodeUnknownSync(JudgeVerdict)(withoutOtherWording),
    ).toThrow();
  });

  it('accepts a fully correct alternative', () => {
    expect(
      isAcceptedAlternative(
        Schema.decodeUnknownSync(JudgeVerdict)(completeVerdict),
      ),
    ).toBe(true);
  });

  it('decodes a verdict without an explanation', () => {
    const verdict = Schema.decodeUnknownSync(JudgeVerdict)({
      ...completeVerdict,
      explanation: null,
    });
    expect(verdict.explanation).toBeNull();
    expect(isAcceptedAlternative(verdict)).toBe(true);
  });

  // A model that proposes an alternative while faulting the answer has still
  // written an explanation worth showing. It is kept and shown; only the
  // write-back is refused, because that is the step that cannot be undone.
  it.each([
    { ...completeVerdict, correct: false },
    { ...completeVerdict, spelling: { ok: false, note: 'Tippfehler' } },
  ])('shows a self-contradicting verdict but never stores it', (input) => {
    const verdict = Schema.decodeUnknownSync(JudgeVerdict)(input);

    expect(verdict.explanation).toBe('Passt.');
    expect(isAcceptedAlternative(verdict)).toBe(false);
  });
});

describe('isOtherWording', () => {
  const otherWording = {
    correct: false,
    acceptAsAlternative: false,
    otherWording: true,
    meaning: { ok: true, note: null },
    grammar: { ok: true, note: null },
    idiomaticity: { ok: true, note: null },
    spelling: { ok: true, note: null },
    intendedConstruction: { ok: false, note: 'anderes Wort' },
    explanation: "Gesucht ist 'enfocarse en algo'.",
  } as const;

  it('lets a rejected, faultless translation in other wording be retried', () => {
    expect(isOtherWording(otherWording)).toBe(true);
  });

  // The model's flag alone is not enough: an accepted answer needs no retry,
  // and a fault in meaning, grammar or spelling is a mistake to learn from.
  it.each([
    { ...otherWording, otherWording: false },
    { ...otherWording, correct: true },
    { ...otherWording, meaning: { ok: false, note: 'unvollständig' } },
    { ...otherWording, grammar: { ok: false, note: 'falsche Präposition' } },
    { ...otherWording, spelling: { ok: false, note: 'Tippfehler' } },
  ])('treats a faulted or accepted answer as no other wording', (verdict) => {
    expect(isOtherWording(verdict)).toBe(false);
  });
});

describe('spelling in the target language', () => {
  // A vocabulary test marks a near miss like 'adolesent' wrong, so it must not
  // pass as known. Into German, a typo says nothing about the word.
  it('asks to fail any misspelling in the target language', () => {
    const base = {
      targetLanguage: 'Spanish',
      prompt: 'der Bleistift',
      expectedAnswers: ['el lápiz'],
      givenAnswer: 'el lapiz',
    } as const;
    const rule = 'any misspelling, a missing, extra or wrong accent';

    expect(judgePrompt({ ...base, direction: 'to_target' })).toContain(rule);
    expect(
      judgePrompt({ ...base, direction: 'to_synonym', meaning: 'Stift' }),
    ).toContain(rule);
    expect(judgePrompt({ ...base, direction: 'to_native' })).not.toContain(
      rule,
    );
  });

  const misspelled = {
    correct: true,
    acceptAsAlternative: false,
    otherWording: true,
    meaning: { ok: true, note: null },
    grammar: { ok: true, note: null },
    idiomaticity: { ok: true, note: null },
    spelling: { ok: false, note: 'Tippfehler' },
    intendedConstruction: { ok: true, note: null },
    explanation: "Richtig wäre 'adolescent'.",
  } as const;
  const base = {
    targetLanguage: 'English',
    expectedAnswers: ['adolescent'],
    givenAnswer: 'adolesent',
  } as const;

  it('overrules a verdict that calls a misspelled answer correct', () => {
    const verdict = enforceTargetSpelling(
      { ...base, direction: 'to_target', prompt: 'der/die Jugendliche' },
      misspelled,
    );

    expect(verdict.correct).toBe(false);
    expect(verdict.otherWording).toBe(false);
    expect(verdict.explanation).toBe(misspelled.explanation);
  });

  it('keeps a misspelled German answer correct', () => {
    expect(
      enforceTargetSpelling(
        { ...base, direction: 'to_native', prompt: 'adolescent' },
        misspelled,
      ),
    ).toBe(misspelled);
  });
});
