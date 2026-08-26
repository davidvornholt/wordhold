import { describe, expect, it } from 'bun:test';
import type { PracticeItem } from '../schemas/practice-models';
import { advanceQueue, createSessionQueue } from './session-queue';

const item = (index: number): PracticeItem => ({
  cardId: `card-${index}`,
  revision: 0,
  direction: 'to_target',
  entryId: `entry-${index}`,
  entryType: 'word',
  targetText: `word-${index}`,
  nativeText: `Wort-${index}`,
  hasAudio: false,
  prompt: `Wort-${index}`,
});

// Long enough that a missed card lands mid-queue rather than at the end.
const pastTheGap = 6;
const shortSession = 3;

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => item(index));

const ids = (queue: { readonly pending: ReadonlyArray<PracticeItem> }) =>
  queue.pending.map((pending) => pending.cardId);

describe('session queue', () => {
  it('drops a card that was answered correctly and moves progress on', () => {
    const queue = advanceQueue(createSessionQueue(items(shortSession)), {
      graded: true,
      correct: true,
      revision: 1,
    });
    expect(ids(queue)).toEqual(['card-1', 'card-2']);
    expect(queue).toMatchObject({ settled: 1, total: 3, correct: 1, wrong: 0 });
  });

  it('brings a missed card back later in the same session', () => {
    const queue = advanceQueue(createSessionQueue(items(pastTheGap)), {
      graded: true,
      correct: false,
      revision: 1,
    });
    expect(ids(queue)).toEqual([
      'card-1',
      'card-2',
      'card-3',
      'card-0',
      'card-4',
      'card-5',
    ]);
    expect(queue).toMatchObject({ settled: 0, total: 6, correct: 0, wrong: 1 });
  });

  it('carries the new revision into the repeat', () => {
    const queue = advanceQueue(createSessionQueue(items(1)), {
      graded: true,
      correct: false,
      revision: 4,
    });
    expect(queue.pending.at(0)).toMatchObject({
      cardId: 'card-0',
      revision: 4,
    });
  });

  it('puts the repeat last when fewer cards are left than the gap', () => {
    const queue = advanceQueue(createSessionQueue(items(2)), {
      graded: true,
      correct: false,
      revision: 1,
    });
    expect(ids(queue)).toEqual(['card-1', 'card-0']);
  });

  it('counts a card once however often it is missed', () => {
    const missTwice = [1, 2].reduce(
      (queue, revision) =>
        advanceQueue(queue, { graded: true, correct: false, revision }),
      createSessionQueue(items(1)),
    );
    const finished = advanceQueue(missTwice, {
      graded: true,
      correct: true,
      revision: 3,
    });
    expect(finished).toMatchObject({
      pending: [],
      settled: 1,
      total: 1,
      correct: 0,
      wrong: 1,
    });
  });

  it('lets an ungraded card go without counting it either way', () => {
    const queue = advanceQueue(createSessionQueue(items(2)), {
      graded: false,
    });
    expect(ids(queue)).toEqual(['card-1']);
    expect(queue).toMatchObject({ settled: 1, correct: 0, wrong: 0 });
  });

  it('ignores an answer once the queue is empty', () => {
    const empty = createSessionQueue([]);
    expect(advanceQueue(empty, { graded: false })).toEqual(empty);
  });
});
