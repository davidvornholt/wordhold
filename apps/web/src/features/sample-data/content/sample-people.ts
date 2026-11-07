import type { AiCall, AiOperation } from '@wordhold/ai/usage';
import type { SampleCourse, SamplePerson, SampleUsage } from './sample-models';
import {
  englishCourse,
  familyEnglishCourse,
  frenchCourse,
  spanishCourse,
} from './sample-words';

const biologyCourse: SampleCourse = {
  kind: 'terms',
  name: 'Biologie',
  terms: [
    {
      term: 'Fotosynthese',
      definition:
        'Vorgang, bei dem Pflanzen mithilfe von Lichtenergie aus Kohlenstoffdioxid und Wasser Traubenzucker und Sauerstoff herstellen.',
      keyPoints: [
        'nutzt Lichtenergie',
        'aus Kohlenstoffdioxid und Wasser',
        'entstehen Traubenzucker und Sauerstoff',
      ],
      progress: 'known',
    },
    {
      term: 'Zellmembran',
      definition:
        'Dünne Hülle, die eine Zelle umgibt und regelt, welche Stoffe hinein- und hinausgelangen.',
      keyPoints: ['umgibt die Zelle', 'regelt den Stoffaustausch'],
      progress: 'due',
    },
    {
      term: 'Mitochondrium',
      definition:
        'Bestandteil der Zelle, in dem durch Zellatmung Energie für die Zelle bereitgestellt wird.',
      keyPoints: [
        'Bestandteil der Zelle',
        'stellt durch Zellatmung Energie bereit',
      ],
      progress: 'fragile',
    },
    {
      term: 'Enzym',
      definition:
        'Eiweiß, das eine chemische Reaktion im Körper beschleunigt, ohne dabei selbst verbraucht zu werden.',
      keyPoints: [
        'ein Eiweiß',
        'beschleunigt eine chemische Reaktion',
        'wird dabei nicht verbraucht',
      ],
      progress: 'today',
    },
    {
      term: 'Osmose',
      definition:
        'Wanderung von Wasser durch eine halbdurchlässige Wand hin zu der Seite, auf der mehr Stoffe gelöst sind.',
      keyPoints: [
        'Wasser wandert durch eine halbdurchlässige Wand',
        'hin zur Seite mit mehr gelösten Stoffen',
      ],
      progress: 'learning',
    },
    {
      term: 'Ökosystem',
      definition:
        'Lebewesen zusammen mit ihrem Lebensraum und den Beziehungen, die zwischen ihnen bestehen.',
      keyPoints: [
        'Lebewesen und ihr Lebensraum',
        'mit ihren Wechselbeziehungen',
      ],
      progress: 'met',
    },
    {
      term: 'Mutation',
      definition:
        'Dauerhafte Veränderung des Erbguts, die an Nachkommen weitergegeben werden kann.',
      keyPoints: ['Veränderung des Erbguts', 'dauerhaft und vererbbar'],
      progress: 'unmet',
    },
    {
      term: 'Chlorophyll',
      definition:
        'Grüner Farbstoff in Pflanzen, der das Licht für die Fotosynthese aufnimmt.',
      keyPoints: [
        'grüner Farbstoff in Pflanzen',
        'nimmt Licht für die Fotosynthese auf',
      ],
      progress: 'unmet',
    },
  ],
};

// Poems written for the sample data.
const poemCourse: SampleCourse = {
  kind: 'texts',
  name: 'Gedichte',
  texts: [
    {
      title: 'Herbstmorgen',
      text: 'Der Nebel liegt noch auf dem Feld,\ndie Krähen ziehen still davon.\nEin erstes Licht kommt in die Welt,\nund aus dem Dorf läutet es schon.',
      progress: 'known',
    },
    {
      title: 'Am Bach',
      text: 'Der Bach erzählt den Steinen viel,\nsie hören zu und sagen nichts.\nEin Blatt treibt ohne Weg und Ziel\nim warmen Gold des Abendlichts.',
      progress: 'due',
    },
    {
      title: 'Abendlied der Amsel',
      text: 'Die Amsel singt vom Dach herab,\nals gäbe es kein Morgen mehr.\nSie singt, bis ich vergessen hab,\nwas mich bedrückt hat, und wie schwer.',
      progress: 'relearning',
    },
    {
      title: 'Winterfenster',
      text: 'Am Fenster blühen Blumen aus Eis,\ndie Stube riecht nach Tee und Brot.\nDie Katze schläft, der Ofen knackt leis,\nund draußen wird der Himmel rot.',
      progress: 'learning',
    },
    {
      title: 'Spruch zum Aufbruch',
      text: 'Wer losgeht, muss nicht alles wissen.\nEs reicht, den nächsten Schritt zu sehen.',
      progress: 'unmet',
    },
  ],
};

// The model the app uses in production, the one the price list covers.
const bedrockModel = 'global.anthropic.claude-sonnet-5-5';

const model = (
  daysAgo: number,
  operation: AiOperation,
  input: number,
  output: number,
): SampleUsage => ({
  daysAgo,
  call: { operation, provider: 'bedrock', model: bedrockModel },
  usage: {
    tokens: { input, cachedInput: 0, cacheWrite: 0, output },
    raw: { inputTokens: input, outputTokens: output },
  },
});

const speech = (daysAgo: number, characters: number): SampleUsage => ({
  daysAgo,
  call: { operation: 'speech', provider: 'polly', model: 'generative' },
  usage: { characters, raw: { requestCharacters: characters } },
});

const transcription = (daysAgo: number, seconds: number): SampleUsage => ({
  daysAgo,
  call: {
    operation: 'transcription',
    provider: 'transcribe',
    model: 'standard',
  },
  usage: { audioSeconds: seconds, raw: { seconds } },
});

const failed = (daysAgo: number, call: AiCall): SampleUsage => ({
  daysAgo,
  call,
  usage: undefined,
});

// The administrator is whoever signs in with the allowlisted GitHub account,
// so a preview opens on these courses.
const administrator: SamplePerson = {
  name: 'Robin Beispiel',
  email: 'robin.beispiel@wordhold.invalid',
  standing: 'administrator',
  joinedDaysAgo: 46,
  lastActiveHoursAgo: 2,
  courses: [
    spanishCourse,
    englishCourse,
    frenchCourse,
    biologyCourse,
    poemCourse,
  ],
  usage: [
    model(45, 'page-extraction', 5200, 1350),
    model(40, 'answer-grading', 1850, 190),
    speech(38, 110),
    model(27, 'page-extraction', 5400, 1300),
    speech(26, 120),
    model(25, 'definition-key-points', 900, 160),
    model(24, 'definition-key-points', 940, 150),
    model(20, 'answer-grading', 1900, 180),
    speech(19, 85),
    model(18.9, 'definition-grading', 1300, 240),
    transcription(14, 18),
    failed(13.01, {
      operation: 'page-extraction',
      provider: 'bedrock',
      model: bedrockModel,
    }),
    model(13, 'page-extraction', 5100, 1250),
    model(12, 'answer-grading', 1880, 170),
    speech(11, 140),
    model(10, 'example-generation', 2100, 600),
    model(9, 'word-relations', 1600, 420),
    model(8, 'spelling-pitfalls', 1500, 380),
    model(6, 'answer-grading', 1920, 210),
    model(5.99, 'definition-grading', 1350, 260),
    model(4, 'page-extraction', 4800, 1100),
    speech(3, 60),
    model(2, 'answer-grading', 1870, 175),
    transcription(1, 22),
    speech(0.2, 95),
    model(0.1, 'answer-grading', 1890, 185),
  ],
};

export const samplePeople: ReadonlyArray<SamplePerson> = [
  administrator,
  {
    name: 'Mila Beispiel',
    email: 'mila.beispiel@wordhold.invalid',
    standing: 'active',
    joinedDaysAgo: 35,
    lastActiveHoursAgo: 3,
    courses: [familyEnglishCourse],
    usage: [
      model(15, 'word-relations', 1500, 400),
      speech(9, 70),
      model(7, 'answer-grading', 1840, 160),
      speech(3, 55),
      model(2.5, 'answer-grading', 1860, 170),
      speech(0.5, 80),
    ],
  },
  {
    name: 'Jonas Beispiel',
    email: 'jonas.beispiel@wordhold.invalid',
    standing: 'invited',
    joinedDaysAgo: 0.1,
    lastActiveHoursAgo: null,
    courses: [],
    usage: [],
  },
  {
    name: 'Greta Beispiel',
    email: 'greta.beispiel@wordhold.invalid',
    standing: 'suspended',
    joinedDaysAgo: 70,
    lastActiveHoursAgo: 50 * 24,
    courses: [],
    usage: [speech(52, 90), model(50, 'answer-grading', 1800, 150)],
  },
];
