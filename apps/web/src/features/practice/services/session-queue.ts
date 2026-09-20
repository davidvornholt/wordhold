import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import type {
  PracticeItem,
  ResolvedSubmitResult,
} from '../schemas/practice-models';

type QueuePhase = 'main' | 'after-round' | 'checkpoint' | 'complete';

type QueuedCard = PracticeItem & {
  readonly repeated: boolean;
};

type ScheduledCard = {
  readonly cardId: string;
  readonly dueAt: Date | null;
};

export type SessionQueue = {
  readonly pending: ReadonlyArray<QueuedCard>;
  readonly remaining: ReadonlyArray<PracticeItem>;
  readonly repeatCards: ReadonlyArray<QueuedCard>;
  readonly scheduled: ReadonlyArray<ScheduledCard>;
  readonly phase: QueuePhase;
  readonly section: number;
  readonly sectionTotal: number;
  readonly sectionProcessed: number;
  // The section's cards in asking order with their latest outcome. The
  // after-round asks the missed cards again and turns their ticks green in
  // place, so one rail tells the whole section's story.
  readonly rail: ReadonlyArray<RailTick>;
  readonly total: number;
  readonly firstTryCorrect: number;
  readonly afterRoundCorrect: number;
  // Cards that left the learning steps during this sitting.
  readonly graduatedCardIds: ReadonlyArray<string>;
  readonly missedCardIds: ReadonlyArray<string>;
  readonly ungradedCardIds: ReadonlyArray<string>;
  readonly processedCardIds: ReadonlyArray<string>;
};

export type RailTick = {
  readonly cardId: string;
  readonly outcome: RailOutcome | null;
};

export type ExpectedCard = Pick<PracticeItem, 'cardId' | 'revision'>;

const beginSection = (
  queue: Omit<SessionQueue, 'pending' | 'sectionTotal' | 'rail'>,
): SessionQueue => {
  const items = queue.remaining.slice(0, sessionSectionSize);
  return {
    ...queue,
    pending: items.map((item) => ({ ...item, repeated: false })),
    remaining: queue.remaining.slice(items.length),
    sectionTotal: items.length,
    rail: items.map((item) => ({ cardId: item.cardId, outcome: null })),
  };
};

export const createSessionQueue = (
  items: ReadonlyArray<PracticeItem>,
): SessionQueue =>
  beginSection({
    remaining: items,
    repeatCards: [],
    scheduled: [],
    phase: items.length === 0 ? 'complete' : 'main',
    section: items.length === 0 ? 0 : 1,
    sectionProcessed: 0,
    total: items.length,
    firstTryCorrect: 0,
    afterRoundCorrect: 0,
    graduatedCardIds: [],
    missedCardIds: [],
    ungradedCardIds: [],
    processedCardIds: [],
  });

const rememberSchedule = (
  scheduled: ReadonlyArray<ScheduledCard>,
  cardId: string,
  dueAt: Date | null,
) => [...scheduled.filter((item) => item.cardId !== cardId), { cardId, dueAt }];

const finishCheckpoint = (queue: SessionQueue): SessionQueue => {
  if (queue.pending.length > 0) {
    return queue;
  }
  if (queue.repeatCards.length > 0) {
    return { ...queue, phase: 'after-round', pending: queue.repeatCards };
  }
  if (queue.remaining.length > 0) {
    return { ...queue, phase: 'checkpoint' };
  }
  return { ...queue, phase: 'complete' };
};

export const continueQueue = (queue: SessionQueue): SessionQueue =>
  queue.phase === 'checkpoint'
    ? beginSection({
        ...queue,
        phase: 'main',
        section: queue.section + 1,
        sectionProcessed: 0,
      })
    : queue;

export const endSession = (queue: SessionQueue): SessionQueue =>
  queue.phase === 'checkpoint'
    ? { ...queue, phase: 'complete', remaining: [] }
    : queue;

const withOutcome = (
  queue: SessionQueue,
  cardId: string,
  outcome: RailOutcome,
): SessionQueue => ({
  ...queue,
  rail: queue.rail.map((tick) =>
    tick.cardId === cardId ? { cardId, outcome } : tick,
  ),
});

const addUnique = (ids: ReadonlyArray<string>, id: string) =>
  ids.includes(id) ? ids : [...ids, id];

export const advanceQueue = (
  queue: SessionQueue,
  expected: ExpectedCard,
  result: ResolvedSubmitResult,
): SessionQueue => {
  const card = queue.pending.at(0);
  if (
    card === undefined ||
    card.cardId !== expected.cardId ||
    card.revision !== expected.revision
  ) {
    return queue;
  }

  const withoutHead = { ...queue, pending: queue.pending.slice(1) };
  const processed =
    queue.phase === 'main'
      ? {
          ...withoutHead,
          sectionProcessed: queue.sectionProcessed + 1,
          processedCardIds: [...queue.processedCardIds, card.cardId],
        }
      : withoutHead;
  if (!result.graded) {
    return finishCheckpoint(
      withOutcome(
        {
          ...processed,
          repeatCards: queue.repeatCards.filter(
            (item) => item.cardId !== card.cardId,
          ),
          ungradedCardIds: addUnique(queue.ungradedCardIds, card.cardId),
        },
        card.cardId,
        'ungraded',
      ),
    );
  }

  const withSchedule = {
    ...processed,
    scheduled: rememberSchedule(
      queue.scheduled,
      card.cardId,
      result.schedule.dueAt,
    ),
  };
  if (result.correct) {
    const graduated =
      result.schedule.state === 'review' && card.state !== 'review';
    const counted = {
      ...withSchedule,
      graduatedCardIds: graduated
        ? addUnique(queue.graduatedCardIds, card.cardId)
        : queue.graduatedCardIds,
    };
    return finishCheckpoint(
      withOutcome(
        queue.phase === 'after-round'
          ? {
              ...counted,
              afterRoundCorrect: queue.afterRoundCorrect + 1,
              repeatCards: queue.repeatCards.filter(
                (item) => item.cardId !== card.cardId,
              ),
            }
          : { ...counted, firstTryCorrect: queue.firstTryCorrect + 1 },
        card.cardId,
        'correct',
      ),
    );
  }

  const repeatCard = {
    ...card,
    revision: result.revision,
    repeated: true,
  };
  return finishCheckpoint(
    withOutcome(
      {
        ...withSchedule,
        repeatCards: [
          ...queue.repeatCards.filter((item) => item.cardId !== card.cardId),
          repeatCard,
        ],
        missedCardIds: addUnique(queue.missedCardIds, card.cardId),
      },
      card.cardId,
      'wrong',
    ),
  );
};

export const earliestScheduledReview = (queue: SessionQueue): Date | null =>
  queue.scheduled.reduce<Date | null>(
    (earliest, item) =>
      item.dueAt !== null && (earliest === null || item.dueAt < earliest)
        ? item.dueAt
        : earliest,
    null,
  );
