import { normalizeAnswer } from '../../../shared/grading/normalize';

export const maximumTextbookReadings = 24;

const optionalGroup = /\((?<inner>[^()]*)\)/u;

const exactReading = (text: string): ReadonlyArray<string> => {
  const normalized = normalizeAnswer(text);
  return normalized === '' ? [] : [normalized];
};

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

const expandNextGroup = (value: string): ReadonlyArray<string> => {
  const match = optionalGroup.exec(value);
  if (match === null) {
    return [value];
  }
  const before = value.slice(0, match.index);
  const after = value.slice(match.index + match[0].length);
  return [`${before}${match.groups?.inner ?? ''}${after}`, `${before}${after}`];
};

export const textbookReadings = (text: string): ReadonlyArray<string> => {
  if (!hasSimpleGroups(text)) {
    return exactReading(text);
  }

  let values: ReadonlyArray<string> = [text];
  while (values.some((value) => optionalGroup.test(value))) {
    const expanded = values.flatMap(expandNextGroup);
    if (expanded.length > maximumTextbookReadings) {
      return exactReading(text);
    }
    values = expanded;
  }

  const exact = normalizeAnswer(text);
  return [
    ...new Set(
      values
        .map(normalizeAnswer)
        .filter((reading) => reading !== '')
        .concat(exact === '' ? [] : [exact]),
    ),
  ];
};
