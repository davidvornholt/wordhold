import { describe, expect, it } from 'bun:test';
import type { RoundScore } from '../schemas/exam-models';
import {
  chartedRounds,
  completedRounds,
  entryGroups,
  missedPracticeSearch,
  type PickableEntry,
  roundParts,
  roundStatus,
  trendText,
} from './exam-figures';

const round = (
  correct: number,
  total: number,
  answered = total,
): RoundScore => ({
  id: `round-${correct}-${total}`,
  startedAt: new Date('2026-11-01T12:00:00.000Z'),
  total,
  answered,
  correct,
  completed: answered >= total,
});

const entry = (
  id: string,
  unit: { readonly id: string; readonly name: string } | null,
): PickableEntry => ({
  id,
  bookId: 'book',
  bookName: 'Band 1',
  unitId: unit?.id ?? null,
  unitName: unit?.name ?? null,
  targetText: `word-${id}`,
  nativeText: `Wort-${id}`,
});

const partCounts = (parts: ReturnType<typeof roundParts>) =>
  parts.map((part) => [part.kind, part.count]);

describe('completedRounds', () => {
  it('keeps the newest completed rounds, oldest first', () => {
    const rounds = Array.from({ length: chartedRounds + 2 }, (_, day) => ({
      ...round(day, 12),
      id: `round-${day}`,
      startedAt: new Date(Date.UTC(2026, 10, day + 1)),
    }));
    const open = {
      ...round(1, 12, 3),
      startedAt: new Date(Date.UTC(2026, 10, 20)),
    };
    expect(
      completedRounds([open, ...[...rounds].reverse()]).map((r) => r.id),
    ).toEqual(rounds.slice(-chartedRounds).map((r) => r.id));
  });
});

describe('roundParts', () => {
  it('splits the first completed round into right and wrong', () => {
    expect(partCounts(roundParts(round(7, 12), null))).toEqual([
      ['right', 7],
      ['wrong', 5],
    ]);
  });

  it('splits the right cards into right twice and right only now', () => {
    expect(partCounts(roundParts(round(10, 12), 6))).toEqual([
      ['right-twice', 6],
      ['right-last', 4],
      ['wrong', 2],
    ]);
  });
});

describe('trendText', () => {
  it('compares two rounds in percent', () => {
    expect(trendText(round(9, 10), round(8, 10))).toBe(
      '10 Prozentpunkte besser als davor',
    );
    expect(trendText(round(50, 100), round(51, 100))).toBe(
      '1 Prozentpunkt schlechter als davor',
    );
    expect(trendText(round(4, 8), round(5, 10))).toBe(
      'so gut wie die Runde davor',
    );
  });
});

describe('roundStatus', () => {
  it('tells a finished round from the open one and a given-up one', () => {
    expect(roundStatus(round(3, 4), false)).toBe('3 von 4 richtig (75 %)');
    expect(roundStatus(round(1, 4, 2), true)).toBe(
      'läuft · 2 von 4 beantwortet',
    );
    expect(roundStatus(round(1, 4, 2), false)).toBe(
      'abgebrochen · 2 von 4 beantwortet',
    );
  });
});

describe('missedPracticeSearch', () => {
  const missed = (entryId: string, direction: 'to_target' | 'to_native') => ({
    cardId: `${entryId}-${direction}`,
    entryId,
    direction,
    targetText: 'mot',
    nativeText: 'Wort',
  });

  it('keeps the one direction all missed cards share', () => {
    expect(
      missedPracticeSearch([
        missed('a', 'to_native'),
        missed('b', 'to_native'),
      ]),
    ).toEqual({ entries: 'a,b', direction: 'to_native' });
  });

  it('practises every direction once the missed cards differ', () => {
    expect(
      missedPracticeSearch([
        missed('a', 'to_native'),
        missed('a', 'to_target'),
      ]),
    ).toEqual({ entries: 'a', direction: 'both' });
  });
});

describe('entryGroups', () => {
  it('groups words by unit and keeps a book’s own words apart', () => {
    const unit = { id: 'unit', name: 'Unité 1' };
    expect(
      entryGroups([entry('a', null), entry('b', unit), entry('c', unit)]).map(
        (group) => [group.label, group.entries.map((member) => member.id)],
      ),
    ).toEqual([
      ['Band 1', ['a']],
      ['Band 1 · Unité 1', ['b', 'c']],
    ]);
  });
});
