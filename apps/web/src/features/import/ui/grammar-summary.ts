import type { GrammarInfo } from '@wordhold/ai/extraction/schema';

const genderLabels = {
  masculine: 'maskulin',
  feminine: 'feminin',
  neuter: 'neutrum',
} as const;

// The book's own annotations (gender, plural, verb forms), read from the scan
// and stored with the entry. Rendered as dictionary-style fine print under the
// word so the learner can check them against the photographed page.
export const grammarSummary = (grammar: GrammarInfo): string => {
  switch (grammar._tag) {
    case 'noun':
      return [
        'Nomen',
        grammar.gender === undefined ? undefined : genderLabels[grammar.gender],
        grammar.plural === undefined ? undefined : `Plural: ${grammar.plural}`,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'verb':
      return [
        'Verb',
        grammar.irregularForms === undefined ||
        grammar.irregularForms.length === 0
          ? undefined
          : `Formen: ${grammar.irregularForms.join(', ')}`,
        grammar.note,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'adjective': {
      const comparison = [grammar.comparative, grammar.superlative]
        .filter(Boolean)
        .join(', ');
      return comparison === ''
        ? 'Adjektiv'
        : `Adjektiv · Steigerung: ${comparison}`;
    }
    case 'other':
      return grammar.note ?? '';
    default:
      return '';
  }
};
