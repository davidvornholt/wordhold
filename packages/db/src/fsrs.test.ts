import { describe, expect, it } from 'bun:test';
import { advancesSchedule, applyRating } from './fsrs';
import type { cards } from './schema/practice';

const ratings = { again: 1, hard: 2, good: 3, easy: 4 } as const;

const newCard: typeof cards.$inferSelect = {
  id: '00000000-0000-0000-0000-000000000001',
  entryId: '00000000-0000-0000-0000-000000000002',
  direction: 'to_target',
  introducedAt: new Date('2026-08-01T09:00:00Z'),
  state: 'new',
  dueAt: null,
  stability: null,
  stabilityFast: null,
  difficulty: null,
  reps: 0,
  lapses: 0,
  scheduledDays: 0,
  learningSteps: 0,
  lastReviewedAt: null,
  revision: 0,
};

describe('applyRating', () => {
  it('schedules a new card into the future after a Good review', () => {
    const now = new Date('2026-08-24T10:00:00Z');
    const next = applyRating(newCard, ratings.good, now);
    expect(next.state).not.toBe('new');
    expect(next.reps).toBe(1);
    expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect(next.stability).toBeGreaterThan(0);
    expect(next.lastReviewedAt).toEqual(now);
  });

  it('keeps an Again review due sooner than a Good review', () => {
    const now = new Date('2026-08-24T10:00:00Z');
    const again = applyRating(newCard, ratings.again, now);
    const good = applyRating(newCard, ratings.good, now);
    expect(again.dueAt.getTime()).toBeLessThanOrEqual(good.dueAt.getTime());
  });

  it('counts a lapse when a learned card fails', () => {
    const now = new Date('2026-08-24T10:00:00Z');
    const learned: typeof cards.$inferSelect = {
      ...newCard,
      state: 'review',
      dueAt: new Date('2026-08-24T08:00:00Z'),
      stability: 10,
      stabilityFast: 2,
      difficulty: 5,
      reps: 4,
      scheduledDays: 10,
      lastReviewedAt: new Date('2026-08-14T08:00:00Z'),
    };
    const next = applyRating(learned, ratings.again, now);
    expect(next.lapses).toBe(1);
    expect(next.state).toBe('relearning');
  });
});

const now = new Date('2026-08-26T20:00:00Z');
const inThreeDays = new Date('2026-08-29T20:00:00Z');
const yesterday = new Date('2026-08-25T20:00:00Z');

describe('advancesSchedule', () => {
  // A client can mislabel the sitting. Only stored card state decides whether
  // FSRS advances, so a future review can never be pushed out early.
  it('holds a review card that is not due yet', () => {
    expect(
      advancesSchedule({ state: 'review', dueAt: inThreeDays }, now, true),
    ).toBe(false);
    expect(advancesSchedule({ state: 'review', dueAt: null }, now, true)).toBe(
      false,
    );
  });

  it('advances a review card that was genuinely due', () => {
    expect(
      advancesSchedule({ state: 'review', dueAt: yesterday }, now, true),
    ).toBe(true);
  });

  // Learning and relearning steps are minutes apart and exist to be answered
  // again, so a repeat inside a custom sitting still counts.
  it('advances a card that is still on a learning step', () => {
    expect(
      advancesSchedule({ state: 'relearning', dueAt: inThreeDays }, now, true),
    ).toBe(true);
    expect(advancesSchedule({ state: 'new', dueAt: null }, now, true)).toBe(
      true,
    );
  });

  it('starts relearning after a wrong early answer', () => {
    expect(
      advancesSchedule({ state: 'review', dueAt: inThreeDays }, now, false),
    ).toBe(true);
  });
});
