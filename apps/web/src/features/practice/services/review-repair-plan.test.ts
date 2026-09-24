import { describe, expect, it } from 'bun:test';
import {
  needsReassessment,
  type RepairCard,
  type RepairReview,
  replayCorrectedReviews,
} from './review-repair-plan';

const stored: RepairCard = {
  id: 'card',
  entryId: 'entry',
  direction: 'to_target',
  state: 'learning',
  introducedAt: new Date('2026-09-21T10:00:00Z'),
  dueAt: null,
  stability: 4,
  difficulty: 9.54,
  reps: 7,
  lapses: 0,
  scheduledDays: 0,
  learningSteps: 0,
  lastReviewedAt: null,
  revision: 7,
};
const review = (id: string, date: string): RepairReview => ({
  id,
  reviewedAt: new Date(date),
  rating: 2,
  answerText: 'el abogado / la abogada',
  elapsedMs: 6000,
  grading: { method: 'judge' },
});

describe('review repair replay', () => {
  it('graduates the repeated correct card without counting premature repeats', () => {
    const reviews = [
      review('a', '2026-09-21T10:01:00Z'),
      review('b', '2026-09-21T10:10:00Z'),
      review('c', '2026-09-21T10:20:00Z'),
    ];
    const repaired = replayCorrectedReviews(
      stored,
      reviews,
      reviews.map((item) => ({
        review: item,
        rating: 3,
        outcome: { method: 'exact' },
      })),
    );
    expect(repaired.state).toBe('review');
    expect(repaired.reps).toBe(2);
    expect(repaired.difficulty).toBeLessThan(stored.difficulty ?? 0);
    expect(repaired.revision).toBe(stored.revision);
  });

  it('leaves skips and already successful reviews out of reassessment', () => {
    const base = review('a', '2026-09-21T10:01:00Z');
    expect(needsReassessment(base)).toBe(true);
    expect(needsReassessment({ ...base, rating: 3 })).toBe(false);
    expect(needsReassessment({ ...base, grading: { method: 'skip' } })).toBe(
      false,
    );
    expect(needsReassessment({ ...base, grading: null })).toBe(false);
  });
});
