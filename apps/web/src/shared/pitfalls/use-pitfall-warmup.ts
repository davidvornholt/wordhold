import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { useEffect, useRef, useState } from 'react';
import type { PreparePitfalls } from './pitfall-model';

type WarmupItem = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly spellingPitfalls: ReadonlyArray<SpellingPitfall> | null;
};

type EntryRequests = Map<
  string,
  Promise<ReadonlyArray<SpellingPitfall> | null>
>;

// Words per request: the card on screen has its pitfalls within seconds, and
// later cards are ready long before they are asked.
const pitfallChunk = 5;

const chunks = (entryIds: ReadonlyArray<string>) =>
  Array.from(
    { length: Math.ceil(entryIds.length / pitfallChunk) },
    (_, index) =>
      entryIds.slice(index * pitfallChunk, (index + 1) * pitfallChunk),
  );

const requestChunk = (
  preparePitfalls: PreparePitfalls,
  entryIds: Array<string>,
  requests: EntryRequests,
) => {
  const response = preparePitfalls({ data: entryIds }).catch(() => []);
  for (const entryId of entryIds) {
    requests.set(
      entryId,
      response.then(
        (prepared) =>
          prepared.find((candidate) => candidate.entryId === entryId)
            ?.pitfalls ?? null,
      ),
    );
  }
};

// A word met for the first time has no pitfalls stored yet. A pass or
// sitting starts without waiting and prepares those of the cards that show
// them a few words at a time in queue order. A word whose pitfalls could not
// be found stays without them until the next pass.
export const usePitfallWarmup = (
  items: ReadonlyArray<WarmupItem>,
  preparePitfalls: PreparePitfalls,
) => {
  const requestsRef = useRef<EntryRequests>(new Map());
  const [prepared, setPrepared] = useState<
    ReadonlyMap<string, ReadonlyArray<SpellingPitfall>>
  >(new Map());

  useEffect(() => {
    const requests = requestsRef.current;
    const missing = [
      ...new Set(
        items
          .filter(
            (item) =>
              item.direction === 'to_target' && item.spellingPitfalls === null,
          )
          .map((item) => item.entryId),
      ),
    ];
    let mounted = true;
    const prepareNext = (entryIds: Array<string>) => {
      const unrequested = entryIds.filter((entryId) => !requests.has(entryId));
      if (unrequested.length > 0) {
        requestChunk(preparePitfalls, unrequested, requests);
      }
      return Promise.all(
        entryIds.map((entryId) =>
          requests.get(entryId)?.then((pitfalls) => {
            if (mounted && pitfalls !== null) {
              setPrepared((current) => new Map(current).set(entryId, pitfalls));
            }
          }),
        ),
      );
    };
    // One request after the other, so the provider is not hit with the
    // whole queue, and none once the pass is left.
    chunks(missing)
      .reduce<Promise<unknown>>(
        (chain, entryIds) =>
          chain.then(() => (mounted ? prepareNext(entryIds) : undefined)),
        Promise.resolve(),
      )
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [items, preparePitfalls]);

  return (item: WarmupItem): ReadonlyArray<SpellingPitfall> | null =>
    item.spellingPitfalls ?? prepared.get(item.entryId) ?? null;
};
