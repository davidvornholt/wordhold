import type { BibleSummary } from '../src/features/bibles/schemas/bible-models';
import {
  formatBibleReference,
  parseBibleReference,
} from '../src/features/bibles/schemas/bible-reference';
import type {
  FoundText,
  TextLookup,
} from '../src/features/courses/ui/text-lookup';
import { psalmVerses, verse } from './text-fixture-data';

export const fixtureBible: BibleSummary = {
  id: '00000000-0000-0000-0000-000000000091',
  name: 'Lutherbibel 1912',
  abbreviation: 'LUT1912',
  verseCount: 31_173,
};

// The chapters the fixture Bible has: as many verses as the Luther Bible of
// 1912 numbers in them, with the text of those the flows look up.
const chapters = new Map<
  string,
  {
    readonly count: number;
    readonly verses: ReadonlyMap<number, string>;
  }
>([
  ['43:3', { count: 36, verses: new Map([[16, verse]]) }],
  [
    '19:23',
    {
      count: 6,
      verses: new Map(psalmVerses.map((text, index) => [index + 1, text])),
    },
  ],
]);

// Looked up the way the server looks up a passage, with its messages.
const lookUpPassage = (typed: string): FoundText => {
  const parsed = parseBibleReference(typed);
  if (parsed.kind === 'invalid') {
    throw new Error(parsed.message);
  }
  const { reference } = parsed;
  const place = formatBibleReference({ ...reference, verses: null });
  const chapter = chapters.get(`${reference.book}:${reference.chapter}`);
  if (chapter === undefined) {
    throw new Error(`${place} steht nicht in ${fixtureBible.abbreviation}.`);
  }
  const { first, last } = reference.verses ?? { first: 1, last: chapter.count };
  if (last > chapter.count) {
    throw new Error(
      `${place} hat in ${fixtureBible.abbreviation} nur ${chapter.count} Verse.`,
    );
  }
  const passage = [...chapter.verses]
    .filter(([number]) => number >= first && number <= last)
    .map(([, text]) => text);
  if (passage.length === 0) {
    throw new Error(
      `${formatBibleReference(reference)} steht nicht in ${fixtureBible.abbreviation}.`,
    );
  }
  return { title: formatBibleReference(reference), text: passage.join('\n') };
};

export const fixtureTextLookup: TextLookup = {
  sources: [{ id: fixtureBible.id, label: fixtureBible.abbreviation }],
  lookUp: (title) =>
    new Promise((resolve) => {
      resolve(lookUpPassage(title));
    }),
};
