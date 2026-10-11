import { useState } from 'react';
import {
  type ExampleGenerationSource,
  exampleGenerationSource,
  type GeneratedExample,
} from '../../../shared/examples/example-draft';
import { type IdentifiedDraftRow, rowsWithoutExample } from './draft-rows';

type BulkExamplesInput = {
  readonly rows: ReadonlyArray<IdentifiedDraftRow>;
  readonly generate: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly onGenerated: (
    rowId: string,
    source: ExampleGenerationSource,
    generated: GeneratedExample,
  ) => void;
};

export type BulkExamplesProgress = {
  readonly done: number;
  readonly total: number;
};

// One sentence request at a time per lane, three lanes: enough to finish a
// page quickly without hitting the provider with the whole page at once.
const lanes = 3;

// Fills every missing example sentence on the page at once, the same way
// "Beispielsatz erzeugen" does per row. Each result lands on its row as it
// arrives; a row whose words changed meanwhile keeps its edit. The state
// lives with the form so a run keeps reporting while its rows fill up.
export const useBulkExamples = ({
  rows,
  generate,
  onGenerated,
}: BulkExamplesInput) => {
  const [progress, setProgress] = useState<BulkExamplesProgress | null>(null);
  const [failed, setFailed] = useState(0);
  // Sentences the last finished run wrote, reported until the next run.
  const [generated, setGenerated] = useState(0);
  const candidates = rowsWithoutExample(rows);

  const generateAll = async () => {
    const queue = [...candidates];
    let done = 0;
    let failures = 0;
    setFailed(0);
    setGenerated(0);
    setProgress({ done: 0, total: queue.length });
    const lane = async () => {
      for (let row = queue.shift(); row !== undefined; row = queue.shift()) {
        const source = exampleGenerationSource(row);
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Sequential within a lane on purpose; lanes run in parallel.
          const example = await generate(source.targetText, source.nativeText);
          onGenerated(row.rowId, source, example);
        } catch {
          failures += 1;
        }
        done += 1;
        setProgress({ done, total: candidates.length });
      }
    };
    await Promise.all(Array.from({ length: lanes }, lane));
    setFailed(failures);
    setGenerated(done - failures);
    setProgress(null);
  };

  return {
    missing: candidates.length,
    progress,
    failed,
    generated,
    generateAll: () => {
      generateAll().catch(() => undefined);
    },
  };
};

export type BulkExamples = ReturnType<typeof useBulkExamples>;
