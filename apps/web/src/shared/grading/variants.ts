import { normalizeAnswer } from './normalize';

// Textbook vocabulary carries optional and alternative parts: "to intend (to)",
// "der/die Angestellte", "die Straße / der Weg". Writing out any one of those
// readings is exactly right, so the deterministic path compares them all
// instead of paying for a judge call and risking a wrong verdict.
const maxVariants = 24;
const optionalGroup = /\s*\((?<inner>[^()]*)\)\s*/u;
const whitespace = /\s+/u;
const phraseSeparator = ' / ';

const expandOptionalGroups = (text: string): ReadonlyArray<string> => {
  const match = optionalGroup.exec(text);
  if (match === null) {
    return [text];
  }
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const inner = match.groups?.inner ?? '';
  return [`${before} ${inner} ${after}`, `${before} ${after}`].flatMap(
    expandOptionalGroups,
  );
};

const expandWord = (word: string): ReadonlyArray<string> =>
  word.includes('/') ? word.split('/').filter((part) => part !== '') : [word];

const expandWordAlternatives = (text: string): ReadonlyArray<string> =>
  text
    .split(whitespace)
    .filter((word) => word !== '')
    .reduce<ReadonlyArray<string>>(
      (sentences, word) =>
        expandWord(word)
          .flatMap((part) =>
            sentences.map((sentence) =>
              sentence === '' ? part : `${sentence} ${part}`,
            ),
          )
          .slice(0, maxVariants),
      [''],
    );

const expandAlternatives = (text: string): ReadonlyArray<string> =>
  text.includes(phraseSeparator)
    ? text.split(phraseSeparator).flatMap(expandWordAlternatives)
    : expandWordAlternatives(text);

// Every reading of one written answer, normalized and deduplicated. The
// answer's own normalized form is always the first entry.
export const answerVariants = (text: string): ReadonlyArray<string> => {
  const readings = expandOptionalGroups(text).flatMap(expandAlternatives);
  return [...new Set([normalizeAnswer(text), ...readings.map(normalizeAnswer)])]
    .filter((variant) => variant !== '')
    .slice(0, maxVariants);
};
