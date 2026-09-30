import {
  maximumKeyPointLength,
  maximumKeyPoints,
} from '@wordhold/ai/definition/schema';

export type KeyPointLines =
  | { readonly kind: 'valid'; readonly keyPoints: ReadonlyArray<string> }
  | { readonly kind: 'invalid'; readonly message: string };

const lineBreak = /\r?\n/u;

// Key points are edited one per line. Blank lines, repeats and surrounding
// spaces are dropped; what is left must fit what grading accepts.
export const parseKeyPointLines = (text: string): KeyPointLines => {
  const keyPoints = [
    ...new Set(
      text
        .split(lineBreak)
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    ),
  ];
  if (keyPoints.length === 0) {
    return { kind: 'invalid', message: 'Trag mindestens einen Kernpunkt ein.' };
  }
  if (keyPoints.length > maximumKeyPoints) {
    return {
      kind: 'invalid',
      message: `Trag höchstens ${maximumKeyPoints} Kernpunkte ein, einen pro Zeile.`,
    };
  }
  if (keyPoints.some((point) => point.length > maximumKeyPointLength)) {
    return {
      kind: 'invalid',
      message: `Ein Kernpunkt darf höchstens ${maximumKeyPointLength} Zeichen lang sein.`,
    };
  }
  return { kind: 'valid', keyPoints };
};
