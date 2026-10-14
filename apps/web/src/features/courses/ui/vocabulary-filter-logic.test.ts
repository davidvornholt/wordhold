import { describe, expect, it } from 'bun:test';
import type { VocabularyEntry } from '../schemas/course-units';
import { byDifficulty, matchesFilter } from './vocabulary-filter-logic';

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
  hardAnswers: 0,
  ...overrides,
});

const pitfall = {
  segments: [
    { text: 'mem', tricky: false },
    { text: 'o', tricky: true },
    { text: 'ry', tricky: false },
  ],
  note: 'Das o wird kaum gesprochen.',
};

const entry = (
  cards: ReadonlyArray<Card>,
  overrides: Partial<VocabularyEntry> = {},
): VocabularyEntry => ({
  id: '00000000-0000-0000-0000-000000000011',
  bookId: '00000000-0000-0000-0000-000000000009',
  bookName: 'Green Line 3',
  unitId: '00000000-0000-0000-0000-000000000003',
  unitName: 'Unit 3',
  targetText: 'memory',
  nativeText: 'die Erinnerung',
  keyPoints: null,
  synonyms: null,
  antonyms: null,
  spellingPitfalls: null,
  example: null,
  introduced: true,
  cards,
  ...overrides,
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

  it('counts a word as difficult once it was not known or right only just', () => {
    const difficult = (overrides: Partial<Card>) =>
      matchesFilter(entry([card(overrides)]), ['to_target'], 'difficult', now);

    expect(difficult({ failures: 1 })).toBe(true);
    expect(difficult({ hardAnswers: 1 })).toBe(true);
    expect(difficult({})).toBe(false);
  });

  it('lists a word by its pitfalls only where it is spelled by the learner', () => {
    const withPitfall = entry([card({})], { spellingPitfalls: [pitfall] });

    expect(matchesFilter(withPitfall, ['to_target'], 'pitfalls', now)).toBe(
      true,
    );
    expect(matchesFilter(withPitfall, ['to_native'], 'pitfalls', now)).toBe(
      false,
    );
    expect(
      matchesFilter(
        entry([card({})], { spellingPitfalls: [] }),
        ['to_target'],
        'pitfalls',
        now,
      ),
    ).toBe(false);
    expect(
      matchesFilter(entry([card({})]), ['to_target'], 'pitfalls', now),
    ).toBe(false);
  });
});

describe('byDifficulty', () => {
  it('puts the most often not known first, then the most often right only just', () => {
    const word = (id: string, overrides: Partial<Card>) =>
      entry([card(overrides), card({ direction: 'to_native', failures: 5 })], {
        id,
      });
    const ordered = [
      word('hard-once', { hardAnswers: 1 }),
      word('missed-once', { failures: 1 }),
      word('missed-twice', { failures: 2 }),
      word('missed-once-hard-twice', { failures: 1, hardAnswers: 2 }),
    ].toSorted(byDifficulty(['to_target']));

    expect(ordered.map((candidate) => candidate.id)).toEqual([
      'missed-twice',
      'missed-once-hard-twice',
      'missed-once',
      'hard-once',
    ]);
  });
});
