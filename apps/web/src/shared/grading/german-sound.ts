// How a German word sounds, for telling which spelling speech recognition
// could not have known. Only spellings of the same sound are folded together:
// "seid" and "seit", "das" and "daß", "Mahl" and "mal", "wieder" and "wider".
// Vowels, "m" and "n" are kept, so "dem" and "den", "der" and "dir" or "ein"
// and "eine" still differ; those are mistakes in what was recited.

const spellings = [
  // "ä" has been folded to "ae" and sounds like "e", as in "Ähre" and "Ehre".
  [/ae/gu, 'e'],
  [/ai/gu, 'ei'],
  [/ie/gu, 'i'],
  [/ph/gu, 'f'],
  [/v/gu, 'f'],
  [/th/gu, 't'],
  [/dt/gu, 't'],
  [/ck/gu, 'k'],
  // An "h" after a vowel only makes it long, as in "wahr" and "war".
  [/(?<vowel>[aeiouy])h(?![aeiouy])/gu, '$<vowel>'],
  [/(?<letter>\p{L})\k<letter>+/gu, '$<letter>'],
  // A final "d", "b" or "g" sounds like "t", "p" or "k".
  [/d$/u, 't'],
  [/b$/u, 'p'],
  [/g$/u, 'k'],
] as const;

// Takes a word as recitation compares it: lowercase, with "ß" as "ss" and
// umlauts as "ae", "oe" and "ue".
export const germanSoundKey = (key: string): string =>
  spellings.reduce(
    (word, [spelling, sound]) => word.replace(spelling, sound),
    key,
  );
