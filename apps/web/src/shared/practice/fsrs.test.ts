import { describe, expect, it } from 'bun:test';
import type { cards } from '@wordhold/db/schema/practice';
import { applyRating } from './fsrs';
import { ratings } from './rating';

const newCard: typeof cards.$inferSelect = {
  id: '00000000-0000-0000-0000-000000000001',
  entryId: '00000000-0000-0000-0000-000000000002',
  direction: 'to_target',
  state: 'new',
  dueAt: null,
  stability: null,
  difficulty: null,
  reps: 0,
  lapses: 0,
  scheduledDays: 0,
  learningSteps: 0,
  lastReviewedAt: null,
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
