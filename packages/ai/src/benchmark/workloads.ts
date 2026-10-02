import type { ModelMessage } from 'ai';
import { Schema } from 'effect';
import { definitionJudgePrompt } from '../definition/judge';
import {
  type DefinitionJudgeInput,
  DefinitionVerdict,
  isDefinitionCorrect,
} from '../definition/schema';
import { ExtractedPage } from '../extraction/schema';
import { extractionPrompt } from '../extraction/service';
import { type JudgeInput, JudgeVerdict } from '../judge/schema';
import { judgePrompt } from '../judge/service';
import { sentenceJudgePrompt } from '../sentence/judge';
import {
  isSentenceCorrect,
  type SentenceJudgeInput,
  SentenceVerdict,
  type SentenceVerdictData,
} from '../sentence/judge-schema';
import { SentenceBatch, sentencePrompt } from '../sentence/service';
import { providerJsonSchema } from './structured-output';

const sentenceCount = 3;
const printedPageNumber = 42;
const vocabularyPattern = /abogad[oa]s?/iu;

export type Workload = {
  readonly name: string;
  readonly prompt: string;
  readonly messages: Array<ModelMessage>;
  readonly schema: ReturnType<typeof providerJsonSchema>;
  readonly qualityFailures: (output: unknown) => ReadonlyArray<string>;
};

const judgeWorkload = (
  name: string,
  input: JudgeInput,
  expectedCorrect: boolean,
): Workload => {
  const prompt = judgePrompt(input);
  return {
    name,
    prompt,
    messages: [{ role: 'user', content: prompt }],
    schema: providerJsonSchema(JudgeVerdict),
    qualityFailures: (output) => {
      if (!Schema.is(JudgeVerdict)(output)) {
        return ['Invalid verdict schema'];
      }
      const failures: Array<string> = [];
      if (output.correct !== expectedCorrect) {
        failures.push('Incorrect verdict');
      }
      if (expectedCorrect) {
        if (!output.acceptAsAlternative) {
          failures.push('Alternative rejected');
        }
        const dimensions = [
          'meaning',
          'grammar',
          'idiomaticity',
          'spelling',
          'intendedConstruction',
        ] as const;
        failures.push(
          ...dimensions
            .filter((dimension) => !output[dimension].ok)
            .map((dimension) => `${dimension} rejected`),
        );
      } else if (output.acceptAsAlternative) {
        failures.push('Wrong alternative accepted');
      }
      return failures;
    },
  };
};

// The expected coverage names which key points the answer states, so a
// verdict that reaches the right total for the wrong reason still fails.
const definitionWorkload = (
  name: string,
  input: DefinitionJudgeInput,
  expectedCoverage: ReadonlyArray<boolean>,
): Workload => {
  const prompt = definitionJudgePrompt(input);
  return {
    name,
    prompt,
    messages: [{ role: 'user', content: prompt }],
    schema: providerJsonSchema(DefinitionVerdict),
    qualityFailures: (output) => {
      if (!Schema.is(DefinitionVerdict)(output)) {
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
      if (!output.accuracy.ok) {
        failures.push('Accurate answer faulted');
      }
      const correct = expectedCoverage.every(Boolean);
      if (isDefinitionCorrect(output) !== correct) {
        failures.push('Incorrect verdict');
      }
      return failures;
    },
  };
};

type SentenceFinding = Exclude<
  keyof SentenceVerdictData,
  'correction' | 'explanation'
>;

// The findings expected to fail, so a verdict that rejects the answer for the
// wrong reason still fails. A rejected answer must also come with a
// correction that fixes it.
const sentenceJudgeWorkload = (
  name: string,
  input: SentenceJudgeInput,
  expectedFaults: ReadonlyArray<SentenceFinding>,
): Workload => {
  const prompt = sentenceJudgePrompt(input);
  const findings = [
    'meaningKept',
    'grammatical',
    'spelledCorrectly',
    'wordUsed',
  ] as const;
  return {
    name,
    prompt,
    messages: [{ role: 'user', content: prompt }],
    schema: providerJsonSchema(SentenceVerdict),
    qualityFailures: (output) => {
      if (!Schema.is(SentenceVerdict)(output)) {
        return ['Invalid verdict schema'];
      }
      const failures = findings.flatMap((finding) => {
        const expectedOk = !expectedFaults.includes(finding);
        if (output[finding] === expectedOk) {
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
  };
};

const lawyerSentence = {
  targetLanguage: 'Spanish',
  sentence: 'Meine Schwester arbeitet als Anwältin in Madrid.',
  reference: 'Mi hermana trabaja como abogada en Madrid.',
  word: { target: 'el/la abogado/-a', german: 'der Anwalt / die Anwältin' },
} as const;

const catalyst = {
  term: 'Katalysator',
  definition:
    'Stoff, der die Aktivierungsenergie einer Reaktion senkt und sie so beschleunigt, ohne dabei verbraucht zu werden.',
  keyPoints: [
    'senkt die Aktivierungsenergie',
    'beschleunigt die Reaktion',
    'wird nicht verbraucht',
  ],
} as const;

// Grading prompts that each return one verdict for a known answer.
const gradingWorkloads = (): ReadonlyArray<Workload> => [
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
  judgeWorkload(
    'judge-abogado',
    {
      direction: 'to_target',
      targetLanguage: 'Spanish',
      prompt: 'der Anwalt / die Anwältin',
      expectedAnswers: ['el/la abogado/-a'],
      givenAnswer: 'el abogado / la abogada',
    },
    true,
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
    false,
  ),
  judgeWorkload(
    'judge-unstated-context',
    {
      direction: 'to_target',
      targetLanguage: 'English',
      prompt: 'synchronisieren',
      expectedAnswers: ['to dub'],
      givenAnswer: 'to synchronize',
    },
    true,
  ),
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
  ),
];

export const workloads = async (): Promise<ReadonlyArray<Workload>> => {
  const sentence = sentencePrompt({
    targetText: 'el/la abogado/-a',
    nativeText: 'der Anwalt / die Anwältin',
    targetLanguage: 'Spanish',
    count: sentenceCount,
  });
  const extraction = extractionPrompt('Spanish');
  const image = new Uint8Array(
    await globalThis.Bun.file(
      new URL('./fixtures/page.png', import.meta.url),
    ).arrayBuffer(),
  );
  return [
    ...gradingWorkloads(),
    {
      name: 'sentences',
      prompt: sentence,
      messages: [{ role: 'user', content: sentence }],
      schema: providerJsonSchema(SentenceBatch),
      qualityFailures: (output) => {
        if (!Schema.is(SentenceBatch)(output)) {
          return ['Invalid sentence schema'];
        }
        const failures: Array<string> = [];
        if (output.sentences.length !== sentenceCount) {
          failures.push('Expected three sentences');
        }
        if (
          output.sentences.some((item) => !vocabularyPattern.test(item.target))
        ) {
          failures.push('Vocabulary missing from sentence');
        }
        return failures;
      },
    },
    {
      name: 'extraction',
      prompt: extraction,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image, mediaType: 'image/png' },
            { type: 'text', text: extraction },
          ],
        },
      ],
      schema: providerJsonSchema(ExtractedPage),
      qualityFailures: (output) => {
        if (!Schema.is(ExtractedPage)(output)) {
          return ['Invalid extraction schema'];
        }
        const failures: Array<string> = [];
        if (output.pageNumber !== printedPageNumber) {
          failures.push('Incorrect page number');
        }
        const expected = [
          ['el/la abogado/-a', 'der Anwalt / die Anwältin'],
          ['obtener algo (como tener)', 'etwas bekommen'],
          ['determinado/-a', 'bestimmt'],
          ['el programa m.', 'das Programm'],
          ['la dirección', 'die Adresse'],
          ['preguntar', 'fragen'],
        ];
        if (output.entries.length !== expected.length) {
          failures.push('Incorrect entry count');
        }
        expected.forEach(([target, native], index) => {
          const entry = output.entries[index];
          if (entry?.targetText !== target || entry.nativeText !== native) {
            failures.push(`Entry ${index + 1} differs`);
          }
        });
        return failures;
      },
    },
  ];
};
