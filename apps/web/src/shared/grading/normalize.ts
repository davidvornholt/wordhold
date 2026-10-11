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
const dashes = /[–—−]/gu;

// Textbooks print marks a keyboard cannot type, and the body font even draws
// a typed "->" as an arrow. Their usual typed spelling copies them exactly:
// "o -> ue" is "o → ue", "no ... nada" is "no … nada", and a dash is a
// hyphen or a minus sign. Arrows and ellipses are notation, so their spacing
// is ignored.
const unifyTypedMarks = (text: string): string =>
  text
    .replace(arrows, (arrow) => {
      const mark = arrow.trim();
      return ` ${typedArrows.get(mark) ?? mark} `;
    })
    .replace(ellipses, ' ... ')
    .replace(dashes, '-');

// Placeholders stand for the object of a phrase: English "sb.", "sth.",
// German "jdn.", "etw.", French "qn", "qch." and Spanish "algn.". Books print
// most with a dot, which learners leave out, and list the placeholders of one
// slot in no fixed order ("sb./sth."). As whole words, a placeholder's dot is
// optional, and placeholders joined by slashes are one slot whatever their
// order or spacing: "to stalk sth/sb" is "to stalk sb./sth.".
const placeholder =
  '(?:sb|smb|sth|smth|jd|jdn|jdm|jds|jmd|jmdn|jmdm|jmds|etw|qn|qqn|qc|qch|qqch|algn)';
const placeholderDot = new RegExp(
  String.raw`(?<![^\s(/])(${placeholder})\.(?=(?:'s)?(?:[\s,;/)]|$))`,
  'gu',
);
const placeholderWord = `${placeholder}(?:'s)?`;
const placeholderSlot = new RegExp(
  String.raw`(?<![^\s(])${placeholderWord}(?:\s*/\s*${placeholderWord})+(?![^\s,;)])`,
  'gu',
);
const wholePlaceholder = new RegExp(`^${placeholderWord}$`, 'u');

export const isPlaceholder = (word: string): boolean =>
  wholePlaceholder.test(word);

export const unifyPlaceholders = (text: string): string =>
  text
    .replace(placeholderDot, '$1')
    .replace(placeholderSlot, (slot) =>
      slot.split(slashSpacing).toSorted().join('/'),
    );

const canonicalAnswer = (text: string): string =>
  text
    .normalize('NFC')
    .replaceAll('’', "'")
    .replace(quoteMarks, '')
    .replace(leadingMarks, '')
    .replace(trailingPunctuation, '')
    .replace(innerWhitespace, ' ')
    .trim();

// Stored answers and judge-cache keys keep their existing canonical form,
// which ignores case: an entry never holds one answer in two cases, and a
// verdict is bound to the answer as typed anyway (see judge-cache.ts).
export const normalizeAnswer = (text: string): string =>
  canonicalAnswer(text).toLowerCase();

// Grading keeps case, since it is part of the spelling: German nouns, the
// English I and CO next to Co. It treats commas as spacing and ignores
// spacing around a slash, so punctuation copied from a textbook never becomes
// part of what the learner must reproduce: "el / la tenista" is
// "el/la tenista". Placeholders come last, once apostrophes are unified, so
// "sb.’s" is "sb's".
export const normalizeAnswerForComparison = (text: string): string =>
  unifyPlaceholders(
    canonicalAnswer(
      unifyTypedMarks(text)
        .replace(ignorableInnerPunctuation, ' ')
        .replace(slashSpacing, '/'),
    ),
  );
