// Chemical formulas lower their indices and raise their charges (H₂O,
// SO₄²⁻), which most keyboards cannot type. A digit or sign typed on the line
// stands for either, so H2O is H₂O and SO42- is SO₄²⁻. One typed raised or
// lowered is taken as written: H²O is not H₂O.
const onTheLine = new Map([
  ...[...'₀₁₂₃₄₅₆₇₈₉'].map((mark, digit) => [mark, String(digit)] as const),
  ...[...'⁰¹²³⁴⁵⁶⁷⁸⁹'].map((mark, digit) => [mark, String(digit)] as const),
  ['₊', '+'],
  ['₋', '-'],
  ['⁺', '+'],
  ['⁻', '-'],
]);

const sameMark = (left: string, right: string): boolean =>
  left === right ||
  onTheLine.get(left) === right ||
  onTheLine.get(right) === left;

// Whether two normalized readings are the same answer.
export const isSameReading = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }
  const leftMarks = [...left];
  const rightMarks = [...right];
  return (
    leftMarks.length === rightMarks.length &&
    leftMarks.every((mark, index) => sameMark(mark, rightMarks[index] ?? ''))
  );
};
