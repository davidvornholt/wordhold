import { useRef, useState } from 'react';
import type {
  PreparedExampleSentence,
  PrepareExamples,
} from '../../../shared/examples/example-model';

// The example may arrive after mount from the sitting's background warm-up;
// whichever source answers first wins, and a later prop is adopted.
export const usePreparedExample = (
  entryId: string,
  initialExample: PreparedExampleSentence | null,
  prepareExamples: PrepareExamples,
) => {
  const [loaded, setExample] = useState(initialExample);
  const example = loaded ?? initialExample;
  const pendingRef = useRef<Promise<PreparedExampleSentence | null> | null>(
    null,
  );
  const loadExample = () => {
    if (example !== null) {
      return Promise.resolve(example);
    }
    pendingRef.current ??= prepareExamples({ data: [entryId] })
      .then(
        (prepared) =>
          prepared.find((candidate) => candidate.entryId === entryId)
            ?.example ?? null,
      )
      .catch(() => null)
      .then((prepared) => {
        setExample(prepared);
        return prepared;
      });
    return pendingRef.current;
  };
  return { example, loadExample } as const;
};
