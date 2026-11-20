import { describe, expect, it } from 'bun:test';
import { advancesSchedule, applyRating, replayReviews } from './fsrs';
import type { cards } from './schema/practice';

const ratings = { again: 1, hard: 2, good: 3, easy: 4 } as const;

const timeZone = 'Europe/Berlin';

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
    const next = applyRating(newCard, ratings.good, now, timeZone);
    expect(next.state).not.toBe('new');
    expect(next.reps).toBe(1);
    expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect(next.stability).toBeGreaterThan(0);
    expect(next.lastReviewedAt).toEqual(now);
  });

  it('keeps an Again review due sooner than a Good review', () => {
    const now = new Date('2026-08-24T10:00:00Z');
    const again = applyRating(newCard, ratings.again, now, timeZone);
    const good = applyRating(newCard, ratings.good, now, timeZone);
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
    const next = applyRating(learned, ratings.again, now, timeZone);
    expect(next.lapses).toBe(1);
    expect(next.state).toBe('relearning');
  });
});

describe('due dates', () => {
  const reviewCard: typeof cards.$inferSelect = {
    ...newCard,
    state: 'review',
    dueAt: new Date('2026-11-20T08:00:00Z'),
    stability: 10,
    stabilityFast: 2,
    difficulty: 5,
    reps: 4,
    scheduledDays: 10,
    lastReviewedAt: new Date('2026-11-10T13:05:00Z'),
  };

  // FSRS-7 alone would bring the card back at whatever minute its interval
  // ends on, such as 00:15 or 16:40.
  it('starts a card due on a later day at midnight in the owner zone', () => {
    const answeredAt = new Date('2026-11-20T13:05:00Z');
    const next = applyRating(reviewCard, ratings.good, answeredAt, timeZone);
    expect(next.scheduledDays).toBeGreaterThan(1);
    expect(next.dueAt.getTime()).toBeGreaterThan(answeredAt.getTime());
    expect(next.dueAt.toLocaleTimeString('de-DE', { timeZone })).toBe(
      '00:00:00',
    );
  });

  it('starts the day in summer time too', () => {
    const answeredAt = new Date('2027-06-20T13:05:00Z');
    const next = applyRating(
      {
        ...reviewCard,
        dueAt: answeredAt,
        lastReviewedAt: new Date('2027-06-10T13:05:00Z'),
      },
      ratings.good,
      answeredAt,
      timeZone,
    );
    expect(next.dueAt.getUTCHours()).toBe(22);
    expect(next.dueAt.toLocaleTimeString('de-DE', { timeZone })).toBe(
      '00:00:00',
    );
  });

  it('keeps the minute of a learning step later the same day', () => {
    const answeredAt = new Date('2026-11-20T13:05:00Z');
    const next = applyRating(newCard, ratings.again, answeredAt, timeZone);
    expect(next.dueAt.getTime() - answeredAt.getTime()).toBe(60_000);
  });

  // A step that ends after midnight is due the next day, so it can be asked
  // from the start of it.
  it('starts a step that crosses midnight at the start of the next day', () => {
    // 23:59:30 in Berlin, a minute before the step ends.
    const answeredAt = new Date('2026-11-20T22:59:30Z');
    const next = applyRating(newCard, ratings.again, answeredAt, timeZone);
    expect(next.dueAt).toEqual(new Date('2026-11-20T23:00:00Z'));
  });
});

// A word first answered right at 14:05 in Berlin comes back 4.78 days later,
// at 08:44 by FSRS's minute, so a right answer at 07:00 that day was given
// before it was due by the minute but after the start of its day.
const replayedOnDueDayMorning = (firstAnswer: string, early: string) =>
  replayReviews(
    [
      { reviewedAt: new Date(firstAnswer), rating: ratings.good },
      { reviewedAt: new Date(early), rating: ratings.good },
    ],
    timeZone,
  );

describe('replayReviews', () => {
  it('holds an early answer given while due dates kept their minute', () => {
    const replayed = replayedOnDueDayMorning(
      '2026-11-10T13:05:00Z',
      '2026-11-15T06:00:00Z',
    );
    expect(replayed.reps).toBe(1);
    expect(replayed.dueAt).toEqual(new Date('2026-11-14T23:00:00Z'));
  });

  it('counts an answer on its due day once due days start at midnight', () => {
    const replayed = replayedOnDueDayMorning(
      '2027-01-10T13:05:00Z',
      '2027-01-15T06:00:00Z',
    );
    expect(replayed.reps).toBe(2);
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
