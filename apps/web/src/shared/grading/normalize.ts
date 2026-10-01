// Deterministic answer normalization: the fast grading path compares
// normalized strings, so the same rules must be applied when seeding
// accepted answers at import and when grading a typed answer.
const quoteMarks = /[«»„“”"]/gu;
const leadingMarks = /^[¿¡\s]+/u;
const trailingPunctuation = /[.,;:!?\s]+$/u;
const innerWhitespace = /\s+/gu;
const ignorableInnerPunctuation = /,+/gu;
const slashSpacing = /\s*\/\s*/gu;
const arrows = /\s*(?:<->|->|<-|=>|[↔→←⇒])\s*/gu;
const typedArrows = new Map([
  ['<->', '↔'],
  ['->', '→'],
  ['<-', '←'],
  ['=>', '⇒'],
]);
const ellipses = /\s*(?:…|\.{3})\s*/gu;
const dashes = /[–—]/gu;

// Textbooks print marks a keyboard cannot type, and the body font even draws
// a typed "->" as an arrow. Their usual typed spelling copies them exactly:
// "o -> ue" is "o → ue", "no ... nada" is "no … nada", and a dash is a
// hyphen. Arrows and ellipses are notation, so their spacing is ignored.
const unifyTypedMarks = (text: string): string =>
  text
    .replace(arrows, (arrow) => {
      const mark = arrow.trim();
      return ` ${typedArrows.get(mark) ?? mark} `;
    })
    .replace(ellipses, ' ... ')
    .replace(dashes, '-');

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
    unifyTypedMarks(text)
      .replace(ignorableInnerPunctuation, ' ')
      .replace(slashSpacing, '/'),
  );
