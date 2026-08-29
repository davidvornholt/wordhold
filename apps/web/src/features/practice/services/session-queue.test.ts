import { describe, expect, it } from 'bun:test';
import { ratings } from '../../../shared/grading/rating';
import { practiceSectionSize } from '../../../shared/practice/session-policy';
import type {
  PracticeItem,
  ResolvedSubmitResult,
} from '../schemas/practice-models';
import {
  advanceQueue,
  continueQueue,
  createSessionQueue,
} from './session-queue';

const minuteLater = new Date('2026-08-29T10:01:00Z');
const thirdRevision = 3;

const item = (index: number): PracticeItem => ({
  cardId: `card-${index}`,
  revision: 0,
  direction: 'to_target',
  entryId: `entry-${index}`,
  targetText: `word-${index}`,
  nativeText: `Wort-${index}`,
  hasAudio: false,
  prompt: `Wort-${index}`,
});

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => item(index));

const result = (
  correct: boolean,
  dueAt: Date | null,
  revision = 1,
): ResolvedSubmitResult => ({
  graded: true,
  correct,
  stored: true,
  revision,
  rating: correct ? ratings.good : ratings.again,
  expectedAnswers: ['word'],
  explanation: null,
  acceptedAsAlternative: false,
  schedule: {
    advanced: true,
    state: correct ? 'review' : 'relearning',
    dueAt,
  },
});

const ungraded: ResolvedSubmitResult = {
  graded: false,
  expectedAnswers: ['word'],
  message: 'Nicht bewertet',
};

const head = (queue: ReturnType<typeof createSessionQueue>) => {
  const card = queue.pending.at(0);
  if (card === undefined) {
    throw new Error('Expected a card at the head of the test queue.');
  }
  return card;
};

const answerHead = (
  queue: ReturnType<typeof createSessionQueue>,
  answer: ResolvedSubmitResult,
) => advanceQueue(queue, head(queue), answer);

describe('session queue', () => {
  it('finishes a correct card and remembers its next review', () => {
    const queue = answerHead(
      createSessionQueue(items(1)),
      result(true, minuteLater),
    );
    expect(queue).toMatchObject({
      phase: 'complete',
      firstTryCorrect: 1,
      sectionProcessed: 1,
    });
    expect(queue.scheduled).toEqual([{ cardId: 'card-0', dueAt: minuteLater }]);
  });

  it('moves a missed final card into the after-round', () => {
    const queue = answerHead(
      createSessionQueue(items(1)),
      result(false, minuteLater),
    );
    expect(queue).toMatchObject({ phase: 'after-round' });
    expect(queue.pending.at(0)).toMatchObject({
      cardId: 'card-0',
      revision: 1,
    });
  });

  it('starts a named after-round at the checkpoint even before the FSRS time', () => {
    const missed = answerHead(
      createSessionQueue(items(2)),
      result(false, minuteLater),
    );
    const checkpoint = answerHead(
      missed,
      result(true, new Date('2026-08-30T10:00:00Z')),
    );
    expect(checkpoint.phase).toBe('after-round');
    expect(head(checkpoint)).toMatchObject({
      cardId: 'card-0',
      repeated: true,
      revision: 1,
    });
    const recovered = answerHead(
      checkpoint,
      result(true, new Date('2026-08-30T10:00:00Z'), 2),
    );
    expect(recovered).toMatchObject({
      phase: 'complete',
      firstTryCorrect: 1,
      afterRoundCorrect: 1,
      repeatCards: [],
    });
  });

  it('keeps a card in the after-round until it is answered correctly', () => {
    const firstMiss = answerHead(
      createSessionQueue(items(1)),
      result(false, minuteLater),
    );
    const secondMiss = answerHead(firstMiss, result(false, minuteLater, 2));
    expect(secondMiss).toMatchObject({ phase: 'after-round' });
    expect(head(secondMiss)).toMatchObject({ cardId: 'card-0', revision: 2 });

    const recovered = answerHead(
      secondMiss,
      result(true, new Date('2026-08-30T10:00:00Z'), thirdRevision),
    );
    expect(recovered).toMatchObject({
      phase: 'complete',
      afterRoundCorrect: 1,
      repeatCards: [],
    });
  });

  it('pauses after twenty cards and continues with the next section', () => {
    const finalSectionSize = 5;
    const total = practiceSectionSize * 2 + finalSectionSize;
    const remaining = total - practiceSectionSize;
    let queue = createSessionQueue(items(total));
    for (let index = 0; index < practiceSectionSize; index += 1) {
      queue = answerHead(queue, result(true, minuteLater));
    }
    expect(queue).toMatchObject({
      phase: 'checkpoint',
      section: 1,
    });
    expect(queue.remaining).toHaveLength(remaining);
    queue = continueQueue(queue);
    expect(queue).toMatchObject({
      phase: 'main',
      section: 2,
      sectionTotal: practiceSectionSize,
    });
  });

  it('tracks an unavailable judge without changing the schedule', () => {
    const queue = answerHead(createSessionQueue(items(1)), ungraded);
    expect(queue).toMatchObject({ phase: 'complete', scheduled: [] });
    expect(queue.ungradedCardIds).toEqual(['card-0']);
  });

  it('ignores a stale transition after the expected card moved on', () => {
    const initial = createSessionQueue(items(2));
    const expected = head(initial);
    const advanced = advanceQueue(initial, expected, result(true, minuteLater));
    expect(advanceQueue(advanced, expected, result(true, minuteLater))).toEqual(
      advanced,
    );
  });
});
