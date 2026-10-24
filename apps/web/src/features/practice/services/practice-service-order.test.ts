import { describe, expect, it } from 'bun:test';
import { Effect, Random } from 'effect';
import { runSessionLoad } from './practice-service-test-support';

const courseId = '00000000-0000-0000-0000-000000000010';

// Cards in the order the session queries return them, as after a learning
// pass: equally urgent, in the order their entries were added.
const loadedCards = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    cardId: `card-${index}`,
    revision: 0,
    direction: 'to_native' as const,
    entryId: `entry-${index}`,
    targetText: `Begriff ${index}`,
    nativeText: `Definition ${index}`,
    relatedWords: [],
    spellingPitfalls: null,
    hasAudio: false,
    entryKnown: false,
  }));

const cardIds = (items: ReadonlyArray<{ readonly cardId: string }>) =>
  items.map((item) => item.cardId);

// The same cards, each once, whatever the order.
const sorted = (ids: ReadonlyArray<string>) =>
  ids.toSorted((left, right) => left.localeCompare(right));

describe('PracticeService asking order', () => {
  it('asks a scheduled section in another order than it was learned', async () => {
    const loaded = loadedCards(20);
    const session = await Effect.runPromise(
      runSessionLoad(
        {
          loadScheduled: () =>
            Effect.succeed({
              items: loaded,
              availability: {
                due: 0,
                firstReviews: 20,
                ready: 20,
                nextDueAt: null,
              },
            }),
          loadSelection: () => Effect.die('no selection was picked'),
        },
        (service) => service.getSession({ courseId, direction: 'both' }),
      ).pipe(Random.withSeed('scheduled')),
    );

    const asked = cardIds(session.items);
    expect(asked).not.toEqual(cardIds(loaded));
    expect(sorted(asked)).toEqual(sorted(cardIds(loaded)));
  });

  it('shuffles a selection within each section and keeps its sections', async () => {
    const loaded = loadedCards(25);
    const session = await Effect.runPromise(
      runSessionLoad(
        {
          loadScheduled: () => Effect.die('the sitting is hand-picked'),
          loadSelection: () => Effect.succeed(loaded),
        },
        (service) =>
          service.getStudySession({
            courseId,
            direction: 'both',
            selection: { unitId: '00000000-0000-0000-0000-000000000011' },
            includeSwitchedOff: true,
          }),
      ).pipe(Random.withSeed('selection')),
    );

    const asked = cardIds(session.items);
    const first = cardIds(loaded.slice(0, 20));
    expect(asked.slice(0, 20)).not.toEqual(first);
    expect(sorted(asked.slice(0, 20))).toEqual(sorted(first));
    expect(sorted(asked.slice(20))).toEqual(sorted(cardIds(loaded.slice(20))));
    expect(session.available.ready).toBe(25);
  });
});
