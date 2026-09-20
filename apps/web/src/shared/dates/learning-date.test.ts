import { describe, expect, it } from 'bun:test';
import { formatLearningDate, formatLearningDateInline } from './learning-date';

const now = new Date('2026-09-20T10:00:00');

describe('formatLearningDateInline', () => {
  it('lowercases only the leading word so nouns keep their case', () => {
    expect(formatLearningDateInline(new Date('2026-09-21T12:40:00'), now)).toBe(
      'morgen um 12:40',
    );
    expect(formatLearningDateInline(new Date('2026-09-17T12:40:00'), now)).toBe(
      'seit 3 Tagen fällig',
    );
  });

  it('leaves the sentence-initial form untouched', () => {
    expect(formatLearningDate(new Date('2026-09-21T12:40:00'), now)).toBe(
      'Morgen um 12:40',
    );
  });
});
