import { normalizeAnswerForComparison } from './normalize';

export const maximumAnswerVariants = 24;

export type AnswerVariantExpansion =
  | {
      readonly _tag: 'Expanded';
      readonly readings: ReadonlyArray<string>;
    }
  | { readonly _tag: 'Overflow' };

export type ExpansionState =
  | { readonly _tag: 'Values'; readonly values: ReadonlyArray<string> }
  | { readonly _tag: 'Overflow' };

export const flatMapBounded = (
  values: ReadonlyArray<string>,
  expand: (value: string) => ReadonlyArray<string>,
): ExpansionState => {
  const expanded: Array<string> = [];
  for (const value of values) {
    for (const part of expand(value)) {
      if (expanded.length === maximumAnswerVariants) {
        return { _tag: 'Overflow' };
      }
      expanded.push(part);
    }
  }
  return { _tag: 'Values', values: expanded };
};

export const normalizeReadings = (
  phrases: ReadonlyArray<string>,
  expand: (phrase: string) => ExpansionState,
): AnswerVariantExpansion => {
  const readings: Array<string> = [];
  for (const phrase of phrases) {
    const alternatives = expand(phrase);
    if (alternatives._tag === 'Overflow') {
      return alternatives;
    }
    for (const reading of alternatives.values) {
      const normalized = normalizeAnswerForComparison(reading);
      if (normalized !== '' && !readings.includes(normalized)) {
        if (readings.length === maximumAnswerVariants) {
          return { _tag: 'Overflow' };
        }
        readings.push(normalized);
      }
    }
  }
  return { _tag: 'Expanded', readings };
};
