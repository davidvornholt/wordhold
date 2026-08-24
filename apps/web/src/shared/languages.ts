import type { LanguageCode } from '@wordhold/db/schema/courses';

// AI prompts speak English; the UI speaks German.
export const englishNames: Record<LanguageCode, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
};

export const germanLabels: Record<LanguageCode, string> = {
  de: 'Deutsch',
  en: 'Englisch',
  es: 'Spanisch',
  fr: 'Französisch',
};
