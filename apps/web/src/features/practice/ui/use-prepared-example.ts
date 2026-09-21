import { useRef, useState } from 'react';
import type {
  PreparedExampleSentence,
  PrepareExamples,
} from '../../../shared/examples/example-model';

export const usePreparedExample = (
  entryId: string,
  initialExample: PreparedExampleSentence | null,
  prepareExamples: PrepareExamples,
) => {
  const [example, setExample] = useState(initialExample);
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
