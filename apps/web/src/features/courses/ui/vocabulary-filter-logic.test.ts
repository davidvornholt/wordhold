import { describe, expect, it } from 'bun:test';
import type { VocabularyEntry } from '../schemas/course-units';
import { matchesFilter } from './vocabulary-filter-logic';

const now = new Date('2026-08-31T12:00:00Z');
const past = new Date('2026-08-30T12:00:00Z');
const future = new Date('2026-09-30T12:00:00Z');

type Card = VocabularyEntry['cards'][number];

const card = (overrides: Partial<Card>): Card => ({
  cardId: '00000000-0000-0000-0000-000000000021',
  direction: 'to_target',
  state: 'review',
  dueAt: past,
  introducedAt: past,
  failures: 0,
  ...overrides,
});

const entry = (cards: ReadonlyArray<Card>): VocabularyEntry => ({
  id: '00000000-0000-0000-0000-000000000011',
  unitId: '00000000-0000-0000-0000-000000000003',
  unitName: 'Unit 3',
  targetText: 'memory',
  nativeText: 'die Erinnerung',
  introduced: true,
  cards,
});

describe('matchesFilter', () => {
  it('matches everything under the all filter', () => {
    expect(matchesFilter(entry([]), [], 'all', now)).toBe(true);
  });

  it('treats only overdue practiced cards as due', () => {
    expect(matchesFilter(entry([card({})]), ['to_target'], 'due', now)).toBe(
      true,
    );
    expect(
      matchesFilter(
        entry([card({ dueAt: future })]),
        ['to_target'],
        'due',
        now,
      ),
    ).toBe(false);
    expect(
      matchesFilter(entry([card({ state: 'new' })]), ['to_target'], 'due', now),
    ).toBe(false);
  });

  it('ignores cards of disabled directions', () => {
    expect(matchesFilter(entry([card({})]), ['to_native'], 'due', now)).toBe(
      false,
    );
    expect(
      matchesFilter(
        entry([card({ failures: 3 })]),
        ['to_native'],
        'difficult',
        now,
      ),
    ).toBe(false);
  });

  it('counts introduced unpracticed cards as first reviews', () => {
    expect(
      matchesFilter(
        entry([card({ state: 'new', dueAt: null })]),
        ['to_target'],
        'first-reviews',
        now,
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        entry([card({ state: 'new', introducedAt: null })]),
        ['to_target'],
        'first-reviews',
        now,
      ),
    ).toBe(false);
  });

  it('needs at least two failures to count as difficult', () => {
    expect(
      matchesFilter(
        entry([card({ failures: 2 })]),
        ['to_target'],
        'difficult',
        now,
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        entry([card({ failures: 1 })]),
        ['to_target'],
        'difficult',
        now,
      ),
    ).toBe(false);
  });
});
