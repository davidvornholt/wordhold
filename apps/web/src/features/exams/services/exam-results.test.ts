import { describe, expect, it } from 'bun:test';
import type { RoundScore } from '../schemas/exam-models';
import {
  examReadiness,
  openRound,
  type RoundCardRow,
  roundScore,
} from './exam-results';

const again = 1;
const hard = 2;
const good = 3;

const round = (id: string, completed: boolean): RoundScore => ({
  id,
  startedAt: new Date('2026-11-01T12:00:00.000Z'),
  total: 3,
  answered: completed ? 3 : 1,
  correct: 1,
  completed,
});

const card = (
  roundId: string,
  cardId: string,
  firstRating: number | null,
): RoundCardRow => ({
  roundId,
  cardId,
  entryId: `entry-${cardId}`,
  direction: 'to_target',
  targetText: `word-${cardId}`,
  nativeText: `Wort-${cardId}`,
  firstRating,
});

describe('roundScore', () => {
  it('completes a round once every card has an answer', () => {
    const counts = {
      id: 'round',
      examId: 'exam',
      startedAt: new Date('2026-11-01T12:00:00.000Z'),
      total: 2,
      correct: 1,
    };
    expect(roundScore({ ...counts, answered: 1 }).completed).toBe(false);
    expect(roundScore({ ...counts, answered: 2 })).toEqual({
      id: 'round',
      startedAt: counts.startedAt,
      total: 2,
      answered: 2,
      correct: 1,
      completed: true,
    });
  });
});

describe('openRound', () => {
  it('offers only the newest round, and only while it is unfinished', () => {
    expect(openRound([round('new', false), round('old', true)])?.id).toBe(
      'new',
    );
    expect(openRound([round('new', true), round('old', false)])).toBeNull();
    expect(openRound([])).toBeNull();
  });
});

describe('examReadiness', () => {
  it('has nothing to report before a round is complete', () => {
    expect(
      examReadiness([round('open', false)], [card('open', 'a', again)]),
    ).toEqual({
      lastRound: null,
      previousRound: null,
      rightTwice: null,
      missed: [],
    });
  });

  it('lists the cards missed in the newest completed round', () => {
    const readiness = examReadiness(
      [round('open', false), round('last', true)],
      [
        card('open', 'a', again),
        card('last', 'a', good),
        card('last', 'b', again),
        card('last', 'c', hard),
      ],
    );
    expect(readiness.lastRound?.id).toBe('last');
    expect(readiness.previousRound).toBeNull();
    expect(readiness.rightTwice).toBeNull();
    expect(readiness.missed.map((missed) => missed.cardId)).toEqual(['b']);
  });

  it('counts the cards right first in both of the two newest completed rounds', () => {
    const readiness = examReadiness(
      [round('last', true), round('given-up', false), round('previous', true)],
      [
        card('last', 'a', good),
        card('last', 'b', good),
        card('last', 'c', again),
        card('given-up', 'b', good),
        card('previous', 'a', hard),
        card('previous', 'b', again),
        card('previous', 'c', good),
      ],
    );
    expect(readiness.previousRound?.id).toBe('previous');
    expect(readiness.rightTwice).toBe(1);
    expect(readiness.missed.map((missed) => missed.cardId)).toEqual(['c']);
  });
});
