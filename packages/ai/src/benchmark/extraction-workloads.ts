import { Effect } from 'effect';
import { fitPageImage } from '../extraction/page-image';
import {
  type ExtractedEntryData,
  ExtractedPage,
  type ExtractedPageData,
  type GrammarInfo,
} from '../extraction/schema';
import { extractionPrompt } from '../extraction/service';
import { readModelOutput } from './structured-output';
import { normalizeText, type Workload } from './workload';

type NounGender = NonNullable<
  Extract<GrammarInfo, { readonly _tag: 'noun' }>['gender']
>;

// A printed entry. `target` is the headword the extracted target must
// contain, since printed grammar may be kept with it or moved to `grammar`.
// `grammar` lists printed forms that must appear somewhere in the entry.
// `gender` is a printed gender marker, which the entry keeps after the
// headword or records as the noun's gender.
type PrintedEntry = {
  readonly target: string;
  readonly native: string;
  readonly example?: string;
  readonly grammar?: ReadonlyArray<string>;
  readonly gender?: { readonly marker: string; readonly value: NounGender };
};

const recordsGender = (
  gender: NonNullable<PrintedEntry['gender']>,
  entry: ExtractedEntryData,
): boolean =>
  normalizeText(entry.targetText).endsWith(` ${gender.marker}`) ||
  (entry.grammar?._tag === 'noun' && entry.grammar.gender === gender.value);

type PrintedPage = {
  readonly file: string;
  readonly targetLanguage: string;
  readonly pageNumber: number;
  readonly entries: ReadonlyArray<PrintedEntry>;
  // Text near the list that is not vocabulary.
  readonly distractors: ReadonlyArray<string>;
};

const entryFailures = (
  printed: PrintedEntry,
  entry: ExtractedEntryData,
  index: number,
): ReadonlyArray<string> => {
  const label = `Entry ${index + 1}`;
  const failures: Array<string> = [];
  if (normalizeText(entry.nativeText) !== printed.native) {
    failures.push(`${label} translation differs`);
  }
  const text = JSON.stringify(entry);
  if (printed.grammar?.some((form) => !text.includes(form))) {
    failures.push(`${label} grammar missing`);
  }
  if (printed.gender !== undefined && !recordsGender(printed.gender, entry)) {
    failures.push(`${label} gender missing`);
  }
  if (printed.example === undefined) {
    return failures;
  }
  if (normalizeText(entry.example ?? '') !== printed.example) {
    failures.push(`${label} example differs`);
  }
  if ((entry.exampleTranslation ?? '').trim() === '') {
    failures.push(`${label} example translation missing`);
  }
  return failures;
};

const pageFailures = (
  page: PrintedPage,
  output: ExtractedPageData,
): ReadonlyArray<string> => {
  const failures: Array<string> = [];
  if (output.pageNumber !== page.pageNumber) {
    failures.push('Incorrect page number');
  }
  if (output.entries.length !== page.entries.length) {
    failures.push('Incorrect entry count');
  }
  // Entries are matched by headword so that one missed entry does not fail
  // every later one; the matched positions must still follow reading order.
  const positions = page.entries.map((printed, index) => {
    const position = output.entries.findIndex((candidate) =>
      normalizeText(candidate.targetText).includes(printed.target),
    );
    const entry = output.entries[position];
    if (entry === undefined) {
      failures.push(`Entry ${index + 1} missing`);
      return -1;
    }
    failures.push(...entryFailures(printed, entry, index));
    return position;
  });
  const found = positions.filter((position) => position >= 0);
  if (
    found.some(
      (position, index) => index > 0 && position <= (found[index - 1] ?? -1),
    )
  ) {
    failures.push('Reading order differs');
  }
  const text = JSON.stringify(output.entries);
  if (page.distractors.some((distractor) => text.includes(distractor))) {
    failures.push('Distractor extracted');
  }
  return failures;
};

const extractionWorkload = async (
  name: string,
  page: PrintedPage,
): Promise<Workload> => {
  const prompt = extractionPrompt(page.targetLanguage);
  // Production fits every photo before the request, so the benchmark does too.
  const image = await Effect.runPromise(
    fitPageImage(
      await globalThis.Bun.file(
        new URL(`./fixtures/${page.file}`, import.meta.url),
      ).bytes(),
    ),
  );
  return {
    name,
    operation: 'page-extraction',
    prompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: image.data.toBase64(),
            mediaType: image.mediaType,
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    schema: ExtractedPage,
    qualityFailures: (answer) => {
      const output = readModelOutput(ExtractedPage)(answer);
      return output === undefined
        ? ['Invalid extraction schema']
        : pageFailures(page, output);
    },
  };
};

export const simplePage: PrintedPage = {
  file: 'page.png',
  targetLanguage: 'Spanish',
  pageNumber: 42,
  entries: [
    { target: 'el/la abogado/-a', native: 'der Anwalt / die Anwältin' },
    { target: 'obtener algo (como tener)', native: 'etwas bekommen' },
    { target: 'determinado/-a', native: 'bestimmt' },
    {
      target: 'el programa',
      native: 'das Programm',
      gender: { marker: 'm.', value: 'masculine' },
    },
    { target: 'la dirección', native: 'die Adresse' },
    { target: 'preguntar', native: 'fragen' },
  ],
  distractors: [],
};

// A photographed page, rendered from dense-page.html with headless Chrome.
export const densePage: PrintedPage = {
  file: 'dense-page.jpg',
  targetLanguage: 'English',
  pageNumber: 117,
  entries: [
    {
      target: 'to bring',
      native: 'bringen',
      example: 'Can you bring your camera?',
      grammar: ['brought'],
    },
    { target: 'castle', native: 'die Burg; das Schloss' },
    {
      target: 'coast',
      native: 'die Küste',
      example: 'We stayed at a hotel on the coast.',
    },
    { target: 'to feel', native: '(sich) fühlen', grammar: ['felt'] },
    { target: 'lonely', native: 'einsam' },
    {
      target: 'ferry',
      native: 'die Fähre',
      example: "The ferry leaves at six o'clock.",
    },
    { target: 'to hike', native: 'wandern' },
    {
      target: 'island',
      native: 'die Insel',
      example: 'Skye is an island in the west of Scotland.',
    },
    { target: 'foggy', native: 'neblig' },
    { target: 'weather forecast', native: 'der Wetterbericht' },
    {
      target: 'to run out of',
      native: 'etw. aufbrauchen',
      example: "We've run out of milk.",
    },
    { target: 'sheep', native: 'das Schaf' },
    {
      target: 'friendly',
      native: 'freundlich',
      grammar: ['friendlier', 'friendliest'],
    },
    {
      target: 'to wonder',
      native: 'sich fragen',
      example: 'I wonder where Tom is.',
    },
  ],
  distractors: ['Karteikarten', 'Eilean Donan', 'Beispielverlag', 'Workbook'],
};

export const extractionWorkloads = (): Promise<ReadonlyArray<Workload>> =>
  Promise.all([
    extractionWorkload('extraction', simplePage),
    extractionWorkload('extraction-photo', densePage),
  ]);
