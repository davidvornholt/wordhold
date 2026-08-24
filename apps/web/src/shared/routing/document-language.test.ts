import { describe, expect, it } from 'bun:test';
import { documentLanguage } from './document-language';

describe('documentLanguage', () => {
  it('keeps the application document in German', () => {
    expect(documentLanguage).toBe('de');
  });
});
