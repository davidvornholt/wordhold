// German numbers as words, so that a "12" in a dictated answer can stand for
// "zwölf" or "zwölften" in the text.

const ones = [
  '',
  'ein',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
] as const;
const teens = [
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
] as const;
const tens = [
  '',
  '',
  'zwanzig',
  'dreißig',
  'vierzig',
  'fünfzig',
  'sechzig',
  'siebzig',
  'achtzig',
  'neunzig',
] as const;

const ten = 10;
const twenty = 20;
const hundred = 100;
const thousand = 1000;
// From a million on, German writes the number in several words.
const plainNumber = /^(?:0|[1-9]\d{0,5})$/u;

const belowHundred = (number: number): string => {
  if (number < ten) {
    return ones[number] ?? '';
  }
  if (number < twenty) {
    return teens[number - ten] ?? '';
  }
  const unit = number % ten;
  const tensWord = tens[Math.floor(number / ten)] ?? '';
  return unit === 0 ? tensWord : `${ones[unit] ?? ''}und${tensWord}`;
};

const belowThousand = (number: number): string => {
  const hundreds = Math.floor(number / hundred);
  const hundredsWord = hundreds === 0 ? '' : `${belowHundred(hundreds)}hundert`;
  return `${hundredsWord}${belowHundred(number % hundred)}`;
};

const cardinal = (number: number): string => {
  if (number === 0) {
    return 'null';
  }
  const thousands = Math.floor(number / thousand);
  const thousandsWord =
    thousands === 0 ? '' : `${belowThousand(thousands)}tausend`;
  const words = `${thousandsWord}${belowThousand(number % thousand)}`;
  // Counted on its own, one is "eins".
  return number % hundred === 1 ? `${words}s` : words;
};

// The ordinal before its ending: "zwölft" for "zwölfte", "erst" for "erste".
const ordinalStems = (word: string, number: number): ReadonlyArray<string> => {
  const irregular = [
    ['eins', ['erst']],
    ['drei', ['dritt']],
    // Older translations write "am siebenten Tag".
    ['sieben', ['siebt', 'siebent']],
    ['acht', ['acht']],
  ] as const;
  for (const [ending, stems] of irregular) {
    if (word.endsWith(ending)) {
      const start = word.slice(0, -ending.length);
      return stems.map((stem) => `${start}${stem}`);
    }
  }
  const lastTwo = number % hundred;
  return [lastTwo > 0 && lastTwo < twenty ? `${word}t` : `${word}st`];
};

// Endings the words of a number take in a sentence: "eine", "einen",
// "zwölften", "dreien".
export const numberWordEndings: ReadonlySet<string> = new Set([
  '',
  'e',
  'en',
  'em',
  'er',
  'es',
  's',
]);

// How a number written in digits can begin when it is written out: as a
// count, with "eins" also as "ein", or as an ordinal. Empty for anything
// that is not a plain number below a million.
export const numberWordStems = (digits: string): ReadonlyArray<string> => {
  if (!plainNumber.test(digits)) {
    return [];
  }
  const number = Number(digits);
  const word = cardinal(number);
  const count = word.endsWith('eins') ? word.slice(0, -1) : word;
  return [count, ...ordinalStems(word, number)];
};

const leadingOne = /(?<before>^|tausend)ein(?=hundert|tausend)/gu;
const joiningAnd = /(?<=hundert|tausend)und(?=\p{L})/gu;

// A written-out number in the form it is compared in. "einhundert" and
// "hundert" are the same number, as are "eintausend" and "tausend", and older
// translations join on the rest with "und", as in "hundertundzwanzig".
export const numberWordKey = (word: string): string =>
  word.replace(leadingOne, '$<before>').replace(joiningAnd, '');
