import { normalizeAnswer } from '../../../shared/grading/normalize';

export const maximumTextbookReadings = 24;

const optionalGroup = /\((?<inner>[^()]*)\)/u;

const hasSimpleGroups = (text: string): boolean => {
  let depth = 0;
  for (const character of text) {
    if (character === '(') {
      depth += 1;
      if (depth > 1) {
        return false;
      }
    } else if (character === ')') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
};

export const textbookReadings = (text: string): ReadonlyArray<string> => {
  const exact = normalizeAnswer(text);
  if (!hasSimpleGroups(text)) {
    return exact === '' ? [] : [exact];
  }

  let values: ReadonlyArray<string> = [text];
  while (values.some((value) => optionalGroup.test(value))) {
    const expanded: Array<string> = [];
    for (const value of values) {
      const match = optionalGroup.exec(value);
      if (match === null) {
        expanded.push(value);
        continue;
      }
      if (expanded.length + 2 > maximumTextbookReadings) {
        return exact === '' ? [] : [exact];
      }
      const before = value.slice(0, match.index);
      const after = value.slice(match.index + match[0].length);
      expanded.push(`${before}${match.groups?.inner ?? ''}${after}`);
      expanded.push(`${before}${after}`);
    }
    values = expanded;
  }

  return [
    ...new Set(
      values
        .map(normalizeAnswer)
        .filter((reading) => reading !== '')
        .concat(exact === '' ? [] : [exact]),
    ),
  ];
};
