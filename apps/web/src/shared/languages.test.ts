import { describe, expect, it } from 'bun:test';
import { languageSubtitle } from './languages';

describe('languageSubtitle', () => {
  it('drops the label when the course is named after its language', () => {
    expect(languageSubtitle('Englisch', 'en')).toBeNull();
  });

  it('keeps the label when the course name says something else', () => {
    expect(languageSubtitle('English A2', 'en')).toBe('Englisch');
  });

  it('keeps the label when the name matches a different language', () => {
    expect(languageSubtitle('Englisch', 'fr')).toBe('Französisch');
  });
});
