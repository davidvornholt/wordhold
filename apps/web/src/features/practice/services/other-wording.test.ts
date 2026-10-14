import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type {
  CourseEntryPlace,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { AnsweredSubmitData } from '../schemas/submission-schema';
import type { AssessedAnswer } from './answer-assessment';
import { allowsAnotherTry, findCourseEntry } from './other-wording';
import { testCard, testSubmission } from './practice-service-test-support';

const passing = { ok: true, note: null } as const;

const otherWording: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  otherWording: true,
  meaning: passing,
  grammar: passing,
  idiomaticity: passing,
  spelling: passing,
  intendedConstruction: { ok: false, note: 'Im Buch steht ein anderes Wort.' },
  explanation: "Gesucht ist 'enfocarse en algo'.",
};

const judged = (verdict: JudgeVerdictData): AssessedAnswer => ({
  outcome: { method: 'judge', verdict },
  assessmentId: '00000000-0000-0000-0000-000000000003',
});

const answered: AnsweredSubmitData = {
  cardId: testCard.id,
  revision: testCard.revision,
  answer: 'concentrarse en algo',
  dictated: false,
  wrongAnswerResolution: 'defer',
  mode: 'scheduled',
};

const intoGerman: SubmissionRecord = {
  ...testSubmission,
  card: { ...testCard, direction: 'to_native' },
};

describe('allowsAnotherTry', () => {
  it('reopens a first answer into the target language in other wording', () => {
    expect(
      allowsAnotherTry(testSubmission, answered, judged(otherWording)),
    ).toBe(true);
  });

  it.each([
    ['into German', intoGerman, answered, judged(otherWording)],
    [
      'to a synonym',
      { ...testSubmission, card: { ...testCard, direction: 'to_synonym' } },
      answered,
      judged(otherWording),
    ],
    [
      'in a terms course',
      { ...testSubmission, courseKind: 'terms' },
      answered,
      judged(otherWording),
    ],
    [
      'when resolving an earlier rejection',
      testSubmission,
      {
        ...answered,
        wrongAnswerResolution: 'again',
        assessmentId: '00000000-0000-0000-0000-000000000003',
      },
      judged(otherWording),
    ],
    [
      'for an incomplete answer',
      testSubmission,
      answered,
      judged({ ...otherWording, otherWording: false }),
    ],
    [
      'for a misspelled answer',
      testSubmission,
      answered,
      judged({ ...otherWording, spelling: { ok: false, note: 'Tippfehler' } }),
    ],
    [
      'for an exact answer',
      testSubmission,
      answered,
      { outcome: { method: 'exact' }, assessmentId: null },
    ],
  ] as const satisfies ReadonlyArray<
    readonly [string, SubmissionRecord, AnsweredSubmitData, AssessedAnswer]
  >)('keeps the verdict %s', (_case, row, data, assessed) => {
    expect(allowsAnotherTry(row, data, assessed)).toBe(false);
  });
});

describe('findCourseEntry', () => {
  const entries: ReadonlyArray<CourseEntryPlace> = [
    { text: 'prestar atención (a algo)', place: 'U3 Mi barrio' },
    {
      text: 'concentrarse (en algo)',
      place: 'U5 Y después del instituto, ¿qué? / ¡Acércate!',
    },
    { text: 'concentrarse', place: 'U7 Exámenes' },
  ];

  it('reads the course entries in textbook notation', () => {
    expect(findCourseEntry('concentrarse en algo', entries)).toEqual({
      text: 'concentrarse (en algo)',
      place: 'U5 Y después del instituto, ¿qué? / ¡Acércate!',
    });
  });

  it('takes the entry the books teach first', () => {
    expect(findCourseEntry('concentrarse', entries)?.place).toBe(
      'U5 Y después del instituto, ¿qué? / ¡Acércate!',
    );
  });

  it('names no entry for a wording the course does not teach', () => {
    expect(findCourseEntry('centrarse en algo', entries)).toBeNull();
    expect(findCourseEntry('concentrarse en algo', [])).toBeNull();
  });
});
