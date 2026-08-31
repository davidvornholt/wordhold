import { describe, expect, it } from 'bun:test';
import { type PracticeSession, remainingReadyCount } from './practice-models';

const session = (
  itemCount: number,
  due: number,
  firstReviews: number,
): PracticeSession => ({
  items: Array.from({ length: itemCount }, (_, index) => ({
    cardId: `00000000-0000-0000-0000-00000000000${index}`,
    revision: 0,
    direction: 'to_target',
    entryId: `00000000-0000-0000-0000-00000000010${index}`,
    targetText: 'memory',
    nativeText: 'Erinnerung',
    hasAudio: false,
    prompt: 'Erinnerung',
  })),
  available: { due, firstReviews, ready: due + firstReviews, nextDueAt: null },
});

describe('remainingReadyCount', () => {
  it('counts the ready cards beyond the loaded section', () => {
    expect(remainingReadyCount(session(20, 25, 3))).toBe(8);
  });

  it('reports zero when the section covers everything', () => {
    expect(remainingReadyCount(session(5, 4, 1))).toBe(0);
  });

  it('never goes negative for selected sessions larger than the plan', () => {
    expect(remainingReadyCount(session(6, 2, 0))).toBe(0);
  });
});
