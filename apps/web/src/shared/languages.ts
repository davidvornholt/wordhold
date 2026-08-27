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

// A course is often named after its language, and printing "Englisch" under a
// course called "Englisch" says nothing. The label is worth showing only when
// it tells the reader something the name did not.
export const languageSubtitle = (
  courseName: string,
  language: LanguageCode,
): string | null =>
  germanLabels[language] === courseName ? null : germanLabels[language];
