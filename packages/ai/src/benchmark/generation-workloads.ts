import { DefinitionSuggestion, KeyPointList } from '../definition/schema';
import { definitionPrompt, keyPointPrompt } from '../definition/writer';
import {
  SentenceBatch,
  SentenceTranslation,
  sentencePrompt,
  sentenceTranslationPrompt,
  WordTranslation,
  type WordTranslationRequest,
  wordTranslationPrompt,
} from '../sentence/service';
import { catalyst, osmosis } from './grading-workloads';
import { readModelOutput } from './structured-output';
import { quoteFailures, textWorkload, type Workload } from './workload';

const sentenceCount = 3;

const sentenceWorkload = (
  name: string,
  word: { readonly target: string; readonly native: string },
  targetLanguage: string,
  usesWord: RegExp,
): Workload =>
  textWorkload({
    name,
    operation: 'example-generation',
    prompt: sentencePrompt({
      targetText: word.target,
      nativeText: word.native,
      targetLanguage,
      count: sentenceCount,
    }),
    schema: SentenceBatch,
    qualityFailures: (answer) => {
      const output = readModelOutput(SentenceBatch)(answer);
      if (output === undefined) {
        return ['Invalid sentence schema'];
      }
      const failures: Array<string> = [];
      if (output.sentences.length !== sentenceCount) {
        failures.push('Expected three sentences');
      }
      if (output.sentences.some((item) => !usesWord.test(item.target))) {
        failures.push('Vocabulary missing from sentence');
      }
      return [
        ...failures,
        ...quoteFailures(
          output.sentences.flatMap((item) => [item.target, item.native]),
        ),
      ];
    },
  });

// `required` patterns must all match the German translation; `forbidden`
// catches a word-for-word rendering.
const translationWorkload = (
  name: string,
  sentence: { readonly text: string; readonly targetLanguage: string },
  required: ReadonlyArray<RegExp>,
  forbidden: RegExp | null,
): Workload =>
  textWorkload({
    name,
    operation: 'example-translation',
    prompt: sentenceTranslationPrompt(sentence.text, sentence.targetLanguage),
    schema: SentenceTranslation,
    qualityFailures: (answer) => {
      const output = readModelOutput(SentenceTranslation)(answer);
      if (output === undefined) {
        return ['Invalid translation schema'];
      }
      return [
        ...required
          .filter((pattern) => !pattern.test(output.native))
          .map((pattern) => `Translation lacks ${pattern.source}`),
        ...(forbidden?.test(output.native) ? ['Literal translation'] : []),
        ...quoteFailures([output.native]),
      ];
    },
  });

const wordWorkload = (
  name: string,
  request: WordTranslationRequest,
  expected: RegExp,
): Workload =>
  textWorkload({
    name,
    operation: 'word-translation',
    prompt: wordTranslationPrompt(request),
    schema: WordTranslation,
    qualityFailures: (answer) => {
      const output = readModelOutput(WordTranslation)(answer);
      if (output === undefined) {
        return ['Invalid translation schema'];
      }
      return [
        ...(expected.test(output.translation)
          ? []
          : ['Unexpected translation']),
        ...quoteFailures([output.translation]),
      ];
    },
  });

// Every pattern must match one of the key points.
const keyPointWorkload = (
  name: string,
  definition: { readonly term: string; readonly definition: string },
  facts: ReadonlyArray<RegExp>,
): Workload =>
  textWorkload({
    name,
    operation: 'definition-key-points',
    prompt: keyPointPrompt(definition),
    schema: KeyPointList,
    qualityFailures: (answer) => {
      const output = readModelOutput(KeyPointList)(answer);
      if (output === undefined) {
        return ['Invalid key point schema'];
      }
      const failures = facts
        .filter(
          (pattern) => !output.keyPoints.some((point) => pattern.test(point)),
        )
        .map((pattern) => `No key point for ${pattern.source}`);
      if (output.keyPoints.some((point) => !point.includes(' '))) {
        failures.push('Bare noun as key point');
      }
      return [...failures, ...quoteFailures(output.keyPoints)];
    },
  });

const sentenceEnd = /[.!?](?:\s+\p{Lu}|\s*$)/gu;

const definitionSuggestionWorkload = (
  name: string,
  request: { readonly term: string; readonly subject: string },
  required: ReadonlyArray<RegExp>,
  forbidden: RegExp,
): Workload =>
  textWorkload({
    name,
    operation: 'definition-suggestion',
    prompt: definitionPrompt(request),
    schema: DefinitionSuggestion,
    qualityFailures: (answer) => {
      const output = readModelOutput(DefinitionSuggestion)(answer);
      if (output === undefined) {
        return ['Invalid definition schema'];
      }
      const failures = required
        .filter((pattern) => !pattern.test(output.definition))
        .map((pattern) => `Definition lacks ${pattern.source}`);
      if (forbidden.test(output.definition)) {
        failures.push('Definition from another subject');
      }
      if ((output.definition.match(sentenceEnd)?.length ?? 0) > 1) {
        failures.push('More than one sentence');
      }
      return [...failures, ...quoteFailures([output.definition])];
    },
  });

export const generationWorkloads: ReadonlyArray<Workload> = [
  sentenceWorkload(
    'sentences',
    { target: 'el/la abogado/-a', native: 'der Anwalt / die Anwältin' },
    'Spanish',
    /abogad[oa]s?/iu,
  ),
  sentenceWorkload(
    'sentences-phrasal-verb',
    { target: 'to look forward to sth.', native: 'sich auf etw. freuen' },
    'English',
    /look(?:s|ed|ing)? forward to/iu,
  ),
  translationWorkload(
    'translation-spanish',
    {
      text: 'Mañana tengo que estudiar para el examen de matemáticas.',
      targetLanguage: 'Spanish',
    },
    [
      /morgen/iu,
      /mathe/iu,
      /lernen|üben|büffeln/iu,
      /prüfung|klausur|test|arbeit/iu,
    ],
    null,
  ),
  translationWorkload(
    'translation-idiom',
    {
      text: "It's raining cats and dogs, so we're staying inside today.",
      targetLanguage: 'English',
    },
    [/regnet|regen|schüttet|gießt/iu, /drinnen|zu ?hause|daheim|im haus/iu],
    /katze|hund/iu,
  ),
  wordWorkload(
    'word-to-german',
    { text: 'el ordenador', given: 'target', targetLanguage: 'Spanish' },
    /^der (?:Computer|Rechner|PC)$/u,
  ),
  wordWorkload(
    'word-noun-article',
    { text: 'die Wohnung', given: 'native', targetLanguage: 'Spanish' },
    /^el (?:piso|apartamento|departamento)$/u,
  ),
  wordWorkload(
    'word-reflexive-verb',
    { text: 'sich beschweren', given: 'native', targetLanguage: 'English' },
    /^to complain(?: \(?about(?: sth\.?)?\)?)?$/u,
  ),
  wordWorkload(
    'word-unit-context',
    {
      text: 'der Speicher',
      given: 'native',
      targetLanguage: 'English',
      context: 'Unit 5 – Computers and the internet',
    },
    /^(?:the |a )?(?:memory|storage)$/iu,
  ),
  wordWorkload(
    'word-french-to-german',
    { text: 'le chapeau', given: 'target', targetLanguage: 'French' },
    /^der Hut$/u,
  ),
  wordWorkload(
    'word-french-gender',
    { text: 'die Brücke', given: 'native', targetLanguage: 'French' },
    /^le pont$/u,
  ),
  keyPointWorkload('key-points-catalyst', catalyst, [
    /Aktivierungsenergie/u,
    /beschleunig/u,
    /verbraucht/u,
  ]),
  keyPointWorkload('key-points-osmosis', osmosis, [
    /Diffusion|diffundier/u,
    /halbdurchlässig/u,
    /Konzentration/u,
  ]),
  definitionSuggestionWorkload(
    'suggestion-photosynthesis',
    { term: 'Photosynthese', subject: 'Biologie' },
    [/Licht/iu, /Kohlenstoffdioxid|CO2|CO₂|Glucose|Glukose|Zucker|organisch/iu],
    /Fotografie|Synthesizer/iu,
  ),
  definitionSuggestionWorkload(
    'suggestion-subject-meaning',
    { term: 'Base', subject: 'Chemie' },
    [/Proton|Hydroxid|OH|Elektronenpaar/u],
    /Potenz|Exponent|Zahlensystem|Grundzahl|Stützpunkt/iu,
  ),
];
