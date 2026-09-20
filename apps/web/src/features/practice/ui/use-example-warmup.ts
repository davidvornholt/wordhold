import { useEffect, useRef, useState } from 'react';
import type {
  PreparedEntryExample,
  PreparedExampleSentence,
  PrepareExamples,
} from '../../../shared/examples/example-model';

type WarmupItem = {
  readonly entryId: string;
  readonly example: PreparedExampleSentence | null;
};

type EntryRequests = Map<string, Promise<PreparedEntryExample | null>>;

const prepareEntry = (
  prepareExamples: PrepareExamples,
  entryId: string,
): Promise<PreparedEntryExample | null> =>
  prepareExamples({ data: [entryId] })
    .then(
      (result) =>
        result.find((candidate) => candidate.entryId === entryId) ?? null,
    )
    .catch(() => null);

// Example sentences and their audio can take seconds to produce the first
// time. The sitting starts without waiting for them and prepares the missing
// ones one entry at a time in queue order, so the card being asked is always
// the next to be ready. A card judged before its example arrived waits only
// for its own entry, joining the request already in flight when there is one.
export const useExampleWarmup = <T extends WarmupItem>(
  items: ReadonlyArray<T>,
  prepareExamples: PrepareExamples,
) => {
  const requestsRef = useRef<EntryRequests>(new Map());
  const [prepared, setPrepared] = useState<
    ReadonlyMap<string, PreparedExampleSentence | null>
  >(new Map());

  useEffect(() => {
    const requests = requestsRef.current;
    const missing = items
      .filter((item) => item.example === null)
      .map((item) => item.entryId);
    let mounted = true;
    const remember = (entryId: string, result: PreparedEntryExample | null) => {
      if (mounted) {
        setPrepared((current) =>
          new Map(current).set(entryId, result?.example ?? null),
        );
      }
    };
    const prepareNext = (entryId: string) => {
      const request =
        requests.get(entryId) ?? prepareEntry(prepareExamples, entryId);
      requests.set(entryId, request);
      return request.then((result) => remember(entryId, result));
    };
    // One entry after the other, on purpose: the card being asked is the
    // next one ready, and the provider is not hit with the whole queue.
    missing
      .reduce(
        (chain, entryId) => chain.then(() => prepareNext(entryId)),
        Promise.resolve(),
      )
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [items, prepareExamples]);

  const prepareThroughWarmup: PrepareExamples = async ({ data }) => {
    const requests = requestsRef.current;
    const results = await Promise.all(
      data.map((entryId) => {
        const request =
          requests.get(entryId) ?? prepareEntry(prepareExamples, entryId);
        requests.set(entryId, request);
        return request;
      }),
    );
    return results.filter(
      (result): result is PreparedEntryExample => result !== null,
    );
  };

  const withExamples = items.map((item) =>
    item.example === null
      ? { ...item, example: prepared.get(item.entryId) ?? null }
      : item,
  );

  return { items: withExamples, prepareExamples: prepareThroughWarmup };
};
