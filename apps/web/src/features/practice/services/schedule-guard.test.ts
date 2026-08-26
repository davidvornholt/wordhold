import { describe, expect, it } from 'bun:test';
import { advancesSchedule } from './schedule-guard';

const now = new Date('2026-08-26T20:00:00Z');
const inThreeDays = new Date('2026-08-29T20:00:00Z');
const yesterday = new Date('2026-08-25T20:00:00Z');

describe('advancesSchedule', () => {
  it('lets the scheduled queue write a schedule whatever the card looks like', () => {
    expect(
      advancesSchedule(
        'scheduled',
        { state: 'review', dueAt: inThreeDays },
        now,
      ),
    ).toBe(true);
  });

  // The whole point of the drill: cramming a word that is not due must not
  // push its next review weeks out.
  it('refuses a drilled card that is not due yet', () => {
    expect(
      advancesSchedule('drill', { state: 'review', dueAt: inThreeDays }, now),
    ).toBe(false);
  });

  it('counts a drilled card that was genuinely due', () => {
    expect(
      advancesSchedule('drill', { state: 'review', dueAt: yesterday }, now),
    ).toBe(true);
  });

  // Learning and relearning steps are minutes apart and exist to be answered
  // again, so a repeat inside the drill still counts.
  it('counts a drilled card that is still on a learning step', () => {
    expect(
      advancesSchedule(
        'drill',
        { state: 'relearning', dueAt: inThreeDays },
        now,
      ),
    ).toBe(true);
    expect(advancesSchedule('drill', { state: 'new', dueAt: null }, now)).toBe(
      true,
    );
  });
});
