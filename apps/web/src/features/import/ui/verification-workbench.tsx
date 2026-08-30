import type { BatchReviewSession } from '../schemas/batch-review-search';
import type { Unit } from '../services/repository';
import { AudioRecovery } from './audio-recovery';
import { BatchReviewProgress } from './batch-review-progress';
import type { DraftEntry } from './entry-row';
import { ExtractionRecovery } from './extraction-recovery';
import { VerificationImage } from './verification-image';
import { type VerificationEntry, VerifyForm } from './verify-form';

type CompletedPage = {
  readonly imported: number | null;
  readonly pending: number | null;
};

type VerificationWorkbenchProps = {
  readonly batchIsLastPage: boolean;
  readonly batchSession: BatchReviewSession | null;
  readonly busy: boolean;
  readonly completed: CompletedPage | null;
  readonly extractionKey: string | null;
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialUnitName: string | undefined;
  readonly onBatchAction: () => void;
  readonly onExtractionRetry: () => void;
  readonly onRetryAudio: () => void;
  readonly onSubmit: (entries: ReadonlyArray<VerificationEntry>) => void;
  readonly pageImageSource: string;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<Unit>;
};

const batchActionLabel = (
  completed: CompletedPage | null,
  lastPage: boolean,
) => {
  if (completed === null) {
    return 'Diese Seite später prüfen';
  }
  return lastPage ? 'Stapel abschließen' : 'Nächste Seite prüfen';
};

const formSubmitLabel = (
  entryCount: number,
  batchSession: BatchReviewSession | null,
  lastPage: boolean,
): string =>
  batchSession !== null && !lastPage
    ? `${entryCount} Einträge importieren und weiter`
    : `${entryCount} Einträge importieren`;

export const VerificationWorkbench = ({
  batchIsLastPage,
  batchSession,
  busy,
  completed,
  extractionKey,
  initialEntries,
  initialUnitName,
  onBatchAction,
  onExtractionRetry,
  onRetryAudio,
  onSubmit,
  pageImageSource,
  targetLabel,
  units,
}: VerificationWorkbenchProps) => (
  <div className="verification-workbench">
    <div className="verification-image-pane">
      <VerificationImage src={pageImageSource} />
    </div>
    <div className="verification-form-pane">
      {batchSession === null ? null : (
        <BatchReviewProgress
          actionLabel={batchActionLabel(completed, batchIsLastPage)}
          busy={busy}
          onAction={onBatchAction}
          position={batchSession.position + 1}
          total={batchSession.pageIds.length}
        />
      )}
      {completed === null ? null : (
        <AudioRecovery
          busy={busy}
          imported={completed.imported}
          onRetry={onRetryAudio}
          pending={completed.pending}
        />
      )}
      {completed === null && extractionKey === null ? (
        <ExtractionRecovery busy={busy} onRetry={onExtractionRetry} />
      ) : null}
      {completed === null && extractionKey !== null ? (
        <VerifyForm
          busy={busy}
          initialEntries={initialEntries}
          initialUnitName={initialUnitName}
          key={extractionKey}
          onSubmit={onSubmit}
          submitLabel={(entryCount) =>
            formSubmitLabel(entryCount, batchSession, batchIsLastPage)
          }
          targetLabel={targetLabel}
          units={units}
        />
      ) : null}
    </div>
  </div>
);
