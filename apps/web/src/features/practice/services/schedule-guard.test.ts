import { describe, expect, it } from 'bun:test';
import { advancesSchedule } from './schedule-guard';

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
  // again, so a repeat inside free practice still counts.
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
