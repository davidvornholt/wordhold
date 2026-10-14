import { type JudgeInput, JudgeVerdict } from '../judge/schema';
import { judgePrompt } from '../judge/service';
import { readModelOutput } from './structured-output';
import { textWorkload, type Workload } from './workload';

const dimensions = [
  'meaning',
  'grammar',
  'idiomaticity',
  'spelling',
  'intendedConstruction',
] as const;

type Dimension = (typeof dimensions)[number];

// `correct` null leaves the verdict to the model where reasonable graders
// differ. Listed faults must fail, so a rejection for the wrong reason fails.
type JudgeExpectation = {
  readonly correct: boolean | null;
  readonly faults: ReadonlyArray<Dimension>;
};

const accepted: JudgeExpectation = { correct: true, faults: [] };

const judgeWorkload = (
  name: string,
  input: JudgeInput,
  expected: JudgeExpectation,
): Workload =>
  textWorkload({
    name,
    operation: 'answer-grading',
    prompt: judgePrompt(input),
    schema: JudgeVerdict,
    qualityFailures: (answer) => {
      const output = readModelOutput(JudgeVerdict)(answer);
      if (output === undefined) {
        return ['Invalid verdict schema'];
      }
      const failures: Array<string> = [];
      if (expected.correct !== null && output.correct !== expected.correct) {
        failures.push('Incorrect verdict');
      }
      if (expected.correct === true) {
        if (!output.acceptAsAlternative) {
          failures.push('Alternative rejected');
        }
        failures.push(
          ...dimensions
            .filter((dimension) => !output[dimension].ok)
            .map((dimension) => `${dimension} rejected`),
        );
        return failures;
      }
      if (output.acceptAsAlternative) {
        failures.push('Wrong alternative accepted');
      }
      failures.push(
        ...expected.faults
          .filter((dimension) => output[dimension].ok)
          .map((dimension) => `${dimension} passed`),
      );
      return failures;
    },
  });

// Vocabulary answers: accepted alternatives, and rejections for a known reason.
export const answerGradingWorkloads: ReadonlyArray<Workload> = [
  judgeWorkload(
    'judge-abogado',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'der Anwalt / die Anwältin',
      expectedAnswers: ['el/la abogado/-a'],
      givenAnswer: 'el abogado / la abogada',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-wrong-gender',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'die Anwältin',
      expectedAnswers: ['la abogada'],
      givenAnswer: 'la abogado',
    },
    { correct: false, faults: [] },
  ),
  judgeWorkload(
    'judge-synonym-to-target',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'synchronisieren',
      expectedAnswers: ['to dub'],
      givenAnswer: 'to synchronize',
    },
    { correct: false, faults: ['intendedConstruction'] },
  ),
  judgeWorkload(
    'judge-regional-variant',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'die Wohnung',
      expectedAnswers: ['el piso'],
      givenAnswer: 'el apartamento',
    },
    { correct: false, faults: ['intendedConstruction'] },
  ),
  judgeWorkload(
    'judge-american-english',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'das Handy',
      expectedAnswers: ['mobile phone'],
      givenAnswer: 'cell phone',
    },
    { correct: false, faults: ['intendedConstruction'] },
  ),
  judgeWorkload(
    'judge-written-out-notation',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'etw. von jdm./etw. erwarten',
      expectedAnswers: ['(to) expect sth. from sb./sth.'],
      givenAnswer: 'to expect sth from sb',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-adapted-pronoun',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'sich durchsetzen, sich behaupten',
      expectedAnswers: ['(to) assert yourself'],
      givenAnswer: 'to assert oneself',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-other-construction',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'jdn. unter Druck setzen',
      expectedAnswers: ['(to) put pressure on sb.'],
      givenAnswer: 'to put sb under pressure',
    },
    { correct: false, faults: ['intendedConstruction'] },
  ),
  judgeWorkload(
    'judge-hedged-alternatives',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'unsicher; verunsichert',
      expectedAnswers: ['insecure'],
      givenAnswer: 'unsure/insecure',
    },
    { correct: false, faults: [] },
  ),
  judgeWorkload(
    'judge-synonym-to-german',
    {
      direction: 'to_native',
      targetLanguage: 'Spanish',
      prompt: 'el ordenador',
      expectedAnswers: ['der Computer'],
      givenAnswer: 'der Rechner',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-false-friend',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'aktuell',
      expectedAnswers: ['current', 'up to date'],
      givenAnswer: 'actual',
    },
    { correct: false, faults: ['meaning'] },
  ),
  judgeWorkload(
    'judge-false-friend-to-german',
    {
      direction: 'to_native',
      targetLanguage: 'Spanish',
      prompt: 'embarazada',
      expectedAnswers: ['schwanger'],
      givenAnswer: 'peinlich',
    },
    { correct: false, faults: ['meaning'] },
  ),
  judgeWorkload(
    'judge-opposite-verb',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'sich etw. (aus)leihen',
      expectedAnswers: ['to borrow sth.'],
      givenAnswer: 'to lend',
    },
    { correct: false, faults: ['meaning'] },
  ),
  judgeWorkload(
    'judge-french-gender',
    {
      direction: 'to_target',
      targetLanguage: 'French',
      prompt: 'der Bahnhof',
      expectedAnswers: ['la gare'],
      givenAnswer: 'le gare',
    },
    { correct: false, faults: [] },
  ),
  judgeWorkload(
    'judge-uncountable-plural',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'die Hausaufgaben',
      expectedAnswers: ['homework'],
      givenAnswer: 'homeworks',
    },
    { correct: false, faults: [] },
  ),
  judgeWorkload(
    'judge-misspelling',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'die Bibliothek',
      expectedAnswers: ['la biblioteca'],
      givenAnswer: 'la bibloteca',
    },
    { correct: false, faults: ['spelling'] },
  ),
  judgeWorkload(
    'judge-missing-accent',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'der Bleistift',
      expectedAnswers: ['el lápiz'],
      givenAnswer: 'el lapiz',
    },
    { correct: false, faults: ['spelling'] },
  ),
  judgeWorkload(
    'judge-unlisted-synonym',
    {
      direction: 'to_synonym',
      targetLanguage: 'English',
      prompt: 'hostile',
      meaning: 'feindselig',
      expectedAnswers: ['unfriendly', 'aggressive'],
      givenAnswer: 'antagonistic',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-synonym-of-other-sense',
    {
      direction: 'to_synonym',
      targetLanguage: 'English',
      prompt: 'bank',
      meaning: 'das Ufer',
      expectedAnswers: ['shore'],
      givenAnswer: 'savings institution',
    },
    { correct: false, faults: ['meaning'] },
  ),
  judgeWorkload(
    'judge-unlisted-antonym',
    {
      direction: 'to_antonym',
      targetLanguage: 'English',
      prompt: 'hostile',
      meaning: 'feindselig',
      expectedAnswers: ['friendly'],
      givenAnswer: 'welcoming',
    },
    accepted,
  ),
  judgeWorkload(
    'judge-synonym-for-antonym',
    {
      direction: 'to_antonym',
      targetLanguage: 'English',
      prompt: 'hostile',
      meaning: 'feindselig',
      expectedAnswers: ['friendly'],
      givenAnswer: 'unfriendly',
    },
    { correct: false, faults: ['meaning'] },
  ),
];
