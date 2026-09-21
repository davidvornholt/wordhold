import { useState } from 'react';
import {
  type ExampleGenerationSource,
  exampleGenerationSource,
  type GeneratedExample,
} from '../../../shared/examples/example-draft';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { type IdentifiedDraftRow, rowsWithoutExample } from './draft-rows';

type BulkExampleGenerationProps = {
  readonly rows: ReadonlyArray<IdentifiedDraftRow>;
  readonly disabled: boolean;
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

// One sentence request at a time per lane, three lanes: enough to finish a
// page quickly without hitting the provider with the whole page at once.
const lanes = 3;

// Fills every missing example sentence on the page with one click, the same
// way "Beispielsatz erzeugen" does per row. Each result lands on its row as
// it arrives; a row whose words changed meanwhile keeps its edit.
export const BulkExampleGeneration = ({
  rows,
  disabled,
  generate,
  onGenerated,
}: BulkExampleGenerationProps) => {
  const [progress, setProgress] = useState<{
    readonly done: number;
    readonly total: number;
  } | null>(null);
  const [failed, setFailed] = useState(0);
  const candidates = rowsWithoutExample(rows);
  if (candidates.length === 0 && progress === null && failed === 0) {
    return null;
  }

  const generateAll = async () => {
    const queue = [...candidates];
    let done = 0;
    let failures = 0;
    setFailed(0);
    setProgress({ done: 0, total: queue.length });
    const lane = async () => {
      for (let row = queue.shift(); row !== undefined; row = queue.shift()) {
        const source = exampleGenerationSource(row);
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Sequential within a lane on purpose; lanes run in parallel.
          const generated = await generate(
            source.targetText,
            source.nativeText,
          );
          onGenerated(row.rowId, source, generated);
        } catch {
          failures += 1;
        }
        done += 1;
        setProgress({ done, total: candidates.length });
      }
    };
    await Promise.all(Array.from({ length: lanes }, lane));
    setFailed(failures);
    setProgress(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {progress === null ? (
        <>
          {candidates.length === 0 ? null : (
            <>
              <span className="text-muted-foreground">
                {countNoun(candidates.length, 'Eintrag', 'Einträge')} ohne
                Beispielsatz
              </span>
              <Button
                disabled={disabled}
                onClick={() => {
                  generateAll().catch(() => undefined);
                }}
                variant="outline"
              >
                Beispielsätze erzeugen
              </Button>
            </>
          )}
          {failed === 0 ? null : (
            <p className="text-destructive" role="alert">
              {countNoun(failed, 'Satz konnte', 'Sätze konnten')} nicht erzeugt
              werden. Versuche es noch einmal oder erzeuge sie einzeln.
            </p>
          )}
        </>
      ) : (
        <p aria-live="polite" className="text-muted-foreground">
          Beispielsätze werden erzeugt … {progress.done} von {progress.total}
        </p>
      )}
    </div>
  );
};
