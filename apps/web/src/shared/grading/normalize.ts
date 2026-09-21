// Deterministic answer normalization: the fast grading path compares
// normalized strings, so the same rules must be applied when seeding
// accepted answers at import and when grading a typed answer.
const quoteMarks = /[«»„“”"]/gu;
const leadingMarks = /^[¿¡\s]+/u;
const trailingPunctuation = /[.,;:!?\s]+$/u;
const innerWhitespace = /\s+/gu;
const ignorableInnerPunctuation = /,+/gu;
const slashSpacing = /\s*\/\s*/gu;

export const normalizeAnswer = (text: string): string =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(quoteMarks, '')
    .replace(leadingMarks, '')
    .replace(trailingPunctuation, '')
    .replace(innerWhitespace, ' ')
    .trim();

// Stored answers and judge-cache keys keep their existing canonical form.
// Grading additionally treats commas as spacing and ignores spacing around a
// slash, so punctuation copied from a textbook never becomes part of what
// the learner must reproduce: "el / la tenista" is "el/la tenista".
export const normalizeAnswerForComparison = (text: string): string =>
  normalizeAnswer(
    text.replace(ignorableInnerPunctuation, ' ').replace(slashSpacing, '/'),
  );
