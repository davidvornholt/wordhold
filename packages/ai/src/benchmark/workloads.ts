import type { ModelMessage } from 'ai';
import { Schema } from 'effect';
import { ExtractedPage } from '../extraction/schema';
import { extractionPrompt } from '../extraction/service';
import { type JudgeInput, JudgeVerdict } from '../judge/schema';
import { judgePrompt } from '../judge/service';
import { SentenceBatch, sentencePrompt } from '../sentence/service';
import { providerJsonSchema } from '../structured-output';

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
