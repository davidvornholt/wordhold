import { describe, expect, it } from 'bun:test';
import { ratings } from '../../../shared/grading/rating';
import { type Progress, progressKinds } from '../content/sample-histories';
import { type ReplayedCard, replayProgress } from './answer-history';

const now = new Date('2026-11-07T18:00:00Z');
const day = 24 * 60 * 60 * 1000;
// Every offset the course writer can give a card, and a little more.
const offsets = Array.from({ length: 61 }, (_, minutes) => minutes);

const replays = (progress: Progress, ratesEasy = true) =>
  offsets.map((offsetMinutes) =>
    replayProgress(progress, { now, offsetMinutes, ratesEasy }),
  );

const daysUntilDue = (card: ReplayedCard) =>
  ((card.schedule.dueAt?.getTime() ?? Number.NaN) - now.getTime()) / day;

const answers = progressKinds
  .flatMap((progress) => [...replays(progress), ...replays(progress, false)])
  .flatMap((card) => card.answers);

describe('replayProgress', () => {
  it('answers only in the past', () => {
    expect(answers.filter((answer) => answer.reviewedAt >= now)).toEqual([]);
  });

  it('rates easy only quick answers to cards in review', () => {
    const easy = answers.filter((answer) => answer.rating === ratings.easy);
    expect(easy.length).toBeGreaterThan(0);
    expect(
      easy.filter(
        (answer) =>
          answer.before.state !== 'review' || answer.elapsedMs >= 5000,
      ),
    ).toEqual([]);
  });

  // A correct answer to a card in review that is not yet due would leave the
  // schedule where it was.
  it('answers cards in review correctly only once they are due', () => {
    expect(
      answers.filter(
        (answer) =>
          answer.before.state === 'review' &&
          answer.rating !== ratings.again &&
          (answer.before.dueAt?.getTime() ?? 0) > answer.reviewedAt.getTime(),
      ),
    ).toEqual([]);
  });

  it('never rates easy when the grading cannot', () => {
    for (const card of replays('mastered', false)) {
      expect(card.answers.map((answer) => answer.rating)).not.toContain(
        ratings.easy,
      );
    }
  });

  it('leaves words not met yet without an introduction or answers', () => {
    for (const card of replays('unmet')) {
      expect(card).toMatchObject({ introducedAt: null, answers: [] });
      expect(card.schedule.state).toBe('new');
    }
  });

  it('introduces met words without answering them', () => {
    for (const card of replays('met')) {
      expect(card.introducedAt?.getTime()).toBeLessThan(now.getTime());
      expect(card.answers).toEqual([]);
      expect(card.schedule.state).toBe('new');
    }
  });

  it('introduces answered words just before their first answer', () => {
    for (const card of replays('known')) {
      expect(card.introducedAt?.getTime()).toBeLessThan(
        card.answers[0]?.reviewedAt.getTime() ?? 0,
      );
    }
  });

  it.each([
    ['learning', 'learning', -1, 0],
    ['due', 'review', -1, 0],
    ['overdue', 'review', -30, -7],
    ['relearning', 'relearning', -3, 0],
    ['fragile', 'review', -10, 0],
    ['today', 'review', 7, 21],
    ['known', 'review', 30, 90],
    ['mastered', 'review', 90, 365],
  ] as const)(
    'leaves %s cards in %s, due between %d and %d days from now',
    (progress, state, earliest, latest) => {
      for (const card of replays(progress)) {
        expect(card.schedule.state).toBe(state);
        expect(daysUntilDue(card)).toBeGreaterThan(earliest);
        expect(daysUntilDue(card)).toBeLessThanOrEqual(latest);
      }
    },
  );

  it('forgets fragile words twice and answers today words today', () => {
    for (const card of replays('fragile')) {
      expect(card.schedule.lapses).toBe(2);
    }
    for (const card of replays('today')) {
      expect(
        now.getTime() - (card.schedule.lastReviewedAt?.getTime() ?? 0),
      ).toBeLessThan(day / 3);
    }
  });
});
