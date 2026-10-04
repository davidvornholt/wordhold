import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { termEntry } from './subject-fixture-data';

export const collectionName = 'Bibelverse';

// Verses from the Luther Bible of 1912, which is in the public domain.
export const verseTitle = 'Johannes 3,16';
export const verse =
  'Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab, auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben.';
// Two mistakes and a typo in 27 words: still known, though not well.
export const nearlyRecited =
  'Also hat Gott die Welt geliebt, dass er seinen eingebornen Sohn gab, auf dass alle, die an ihn glauben, nicht verloren gehen, sondern das Leben haben.';
const psalm = [
  'Der HERR ist mein Hirte; mir wird nichts mangeln.',
  'Er weidet mich auf einer grünen Aue und führet mich zum frischen Wasser.',
  'Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen.',
].join('\n');

const storedTexts = [
  { title: verseTitle, text: verse, introduced: true, failures: 1 },
  { title: 'Psalm 23,1–3', text: psalm, introduced: true, failures: 0 },
  {
    title: 'Römer 8,28',
    text: 'Wir wissen aber, daß denen, die Gott lieben, alle Dinge zum Besten dienen, denen, die nach dem Vorsatz berufen sind.',
    introduced: false,
    failures: 0,
  },
];

// A text is stored like a term: its title asks for it, and its one card is
// answered with the text.
export const textEntry = (
  index: number,
  {
    title,
    text,
    introduced,
    failures,
  }: {
    readonly title: string;
    readonly text: string;
    readonly introduced: boolean;
    readonly failures: number;
  },
): VocabularyEntry =>
  termEntry(index, {
    term: title,
    definition: text,
    keyPoints: null,
    introduced,
    failures,
  });

export const collectionEntries = storedTexts.map((stored, index) =>
  textEntry(index + 1, stored),
);
