import { definitionJudgePrompt } from '../definition/judge';
import {
  type DefinitionJudgeInput,
  DefinitionVerdict,
  isDefinitionCorrect,
} from '../definition/schema';
import { sentenceJudgePrompt } from '../sentence/judge';
import {
  isSentenceCorrect,
  type SentenceJudgeInput,
  SentenceVerdict,
  type SentenceVerdictData,
} from '../sentence/judge-schema';
import { answerGradingWorkloads } from './answer-grading-workloads';
import { readModelOutput } from './structured-output';
import { textWorkload, type Workload } from './workload';

// The expected coverage names which key points the answer states, so a
// verdict that reaches the right total for the wrong reason still fails.
const definitionWorkload = (
  name: string,
  input: DefinitionJudgeInput,
  expectedCoverage: ReadonlyArray<boolean>,
  expectedAccurate = true,
): Workload =>
  textWorkload({
    name,
    operation: 'definition-grading',
    prompt: definitionJudgePrompt(input),
    schema: DefinitionVerdict,
    qualityFailures: (answer) => {
      const output = readModelOutput(DefinitionVerdict)(answer);
      if (output === undefined) {
        return ['Invalid verdict schema'];
      }
      if (output.keyPoints.length !== expectedCoverage.length) {
        return ['Key point count differs'];
      }
      const failures = expectedCoverage.flatMap((covered, index) =>
        output.keyPoints[index]?.covered === covered
          ? []
          : [`Key point ${index + 1} ${covered ? 'missed' : 'credited'}`],
      );
      if (output.accuracy.ok !== expectedAccurate) {
        failures.push(
          expectedAccurate
            ? 'Accurate answer faulted'
            : 'False statement passed',
        );
      }
      const correct = expectedCoverage.every(Boolean) && expectedAccurate;
      if (isDefinitionCorrect(output) !== correct) {
        failures.push('Incorrect verdict');
      }
      return failures;
    },
  });

type SentenceFinding = Exclude<
  keyof SentenceVerdictData,
  'correction' | 'explanation'
>;

// The findings expected to fail, so a verdict that rejects the answer for the
// wrong reason still fails. Debatable findings are not checked either way. A
// rejected answer must also come with a correction that fixes it.
const sentenceJudgeWorkload = (
  name: string,
  input: SentenceJudgeInput,
  expectedFaults: ReadonlyArray<SentenceFinding>,
  debatable: ReadonlyArray<SentenceFinding> = [],
): Workload => {
  const findings = [
    'meaningKept',
    'grammatical',
    'spelledCorrectly',
    'wordUsed',
  ] as const;
  return textWorkload({
    name,
    operation: 'sentence-grading',
    prompt: sentenceJudgePrompt(input),
    schema: SentenceVerdict,
    qualityFailures: (answer) => {
      const output = readModelOutput(SentenceVerdict)(answer);
      if (output === undefined) {
        return ['Invalid verdict schema'];
      }
      const failures = findings.flatMap((finding) => {
        const expectedOk = !expectedFaults.includes(finding);
        if (output[finding] === expectedOk || debatable.includes(finding)) {
          return [];
        }
        return [`${finding} ${expectedOk ? 'faulted' : 'passed'}`];
      });
      const correct = expectedFaults.length === 0;
      if (isSentenceCorrect(output) !== correct) {
        failures.push('Incorrect verdict');
      }
      if (!correct && output.correction === null) {
        failures.push('Correction missing');
      }
      return failures;
    },
  });
};

const lawyerSentence = {
  targetLanguage: 'Spanish',
  sentence: 'Meine Schwester arbeitet als Anwältin in Madrid.',
  reference: 'Mi hermana trabaja como abogada en Madrid.',
  word: { target: 'el/la abogado/-a', german: 'der Anwalt / die Anwältin' },
} as const;

const tripSentence = {
  targetLanguage: 'English',
  sentence: 'Ich freue mich schon auf die Klassenfahrt nach London.',
  reference: "I'm already looking forward to the class trip to London.",
  word: { target: 'to look forward to sth.', german: 'sich auf etw. freuen' },
} as const;

export const catalyst = {
  term: 'Katalysator',
  definition:
    'Stoff, der die Aktivierungsenergie einer Reaktion senkt und sie so beschleunigt, ohne dabei verbraucht zu werden.',
  keyPoints: [
    'senkt die Aktivierungsenergie',
    'beschleunigt die Reaktion',
    'wird nicht verbraucht',
  ],
} as const;

export const osmosis = {
  term: 'Osmose',
  definition:
    'Diffusion von Wasser durch eine halbdurchlässige Membran zur Seite mit der höheren Konzentration gelöster Stoffe.',
  keyPoints: [
    'Diffusion von Wasser',
    'durch eine halbdurchlässige Membran',
    'zur Seite mit der höheren Konzentration gelöster Stoffe',
  ],
} as const;

const definitionGrading: ReadonlyArray<Workload> = [
  definitionWorkload(
    'definition-paraphrase',
    {
      ...catalyst,
      givenAnswer:
        'Er setzt die Aktivierungsenergie herab, wodurch die Reaktion schneller abläuft, und liegt am Ende unverändert vor.',
    },
    [true, true, true],
  ),
  definitionWorkload(
    'definition-missing-term',
    {
      ...catalyst,
      givenAnswer: 'beschleunigt Reaktionen und wird nicht verbraucht',
    },
    [false, true, true],
  ),
  definitionWorkload(
    'definition-false-statement',
    {
      ...catalyst,
      givenAnswer:
        'Er erhöht die Aktivierungsenergie, beschleunigt dadurch die Reaktion und wird dabei nicht verbraucht.',
    },
    [false, true, true],
    false,
  ),
  definitionWorkload(
    'definition-synonym',
    {
      ...osmosis,
      givenAnswer:
        'Wasser diffundiert durch eine semipermeable Membran dorthin, wo die Konzentration gelöster Teilchen höher ist.',
    },
    [true, true, true],
  ),
  definitionWorkload(
    'definition-reversed',
    {
      ...osmosis,
      givenAnswer:
        'Wasser diffundiert durch eine semipermeable Membran dorthin, wo die Konzentration gelöster Teilchen niedriger ist.',
    },
    [true, true, false],
    false,
  ),
];

const sentenceGrading: ReadonlyArray<Workload> = [
  sentenceJudgeWorkload(
    'sentence-judge-paraphrase',
    {
      ...lawyerSentence,
      givenAnswer: 'Mi hermana trabaja de abogada en Madrid.',
    },
    [],
  ),
  sentenceJudgeWorkload(
    'sentence-judge-wrong-gender',
    {
      ...lawyerSentence,
      givenAnswer: 'Mi hermana trabaja como abogado en Madrid.',
    },
    ['grammatical'],
  ),
  sentenceJudgeWorkload(
    'sentence-judge-avoided-word',
    {
      ...lawyerSentence,
      givenAnswer: 'Mi hermana trabaja como jurista en Madrid.',
    },
    ['wordUsed'],
    // 'Jurista' is broader than 'Anwältin', so a strict grader may also
    // reject the meaning.
    ['meaningKept'],
  ),
  sentenceJudgeWorkload(
    'sentence-judge-changed-tense',
    {
      ...lawyerSentence,
      givenAnswer: 'Mi hermana trabajaba como abogada en Madrid.',
    },
    ['meaningKept'],
  ),
  sentenceJudgeWorkload(
    'sentence-judge-misspelling',
    {
      ...lawyerSentence,
      givenAnswer: 'Mi ermana trabaja como abogada en Madrid.',
    },
    ['spelledCorrectly'],
  ),
  sentenceJudgeWorkload(
    'sentence-judge-word-order',
    {
      ...tripSentence,
      givenAnswer: "I'm looking forward to the class trip to London already.",
    },
    [],
  ),
];

// Grading prompts that each return one verdict for a known answer.
export const gradingWorkloads: ReadonlyArray<Workload> = [
  ...answerGradingWorkloads,
  ...definitionGrading,
  ...sentenceGrading,
];
