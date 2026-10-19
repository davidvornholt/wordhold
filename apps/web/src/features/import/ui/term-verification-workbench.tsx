import { countNoun } from '../../../shared/format/count';
import { ActionLink } from '../../../shared/ui/action-link';
import type { BatchReviewSession } from '../schemas/batch-review-search';
import type { NotesReading } from '../services/repository';
import { BatchReviewProgress } from './batch-review-progress';
import { ExtractionRecovery } from './extraction-recovery';
import type { TermDraft } from './term-draft-rows';
import { TermReviewForm } from './term-review-form';
import { VerificationImage } from './verification-image';

const submitLabel = (
  termCount: number,
  batchSession: BatchReviewSession | null,
  lastPage: boolean,
): string => {
  const action =
    termCount === 0
      ? 'Seite abschließen'
      : `${countNoun(termCount, 'Begriff', 'Begriffe')} eintragen`;
  return batchSession !== null && !lastPage ? `${action} und weiter` : action;
};

const draftsFrom = (reading: NotesReading): ReadonlyArray<TermDraft> =>
  reading.notes.terms.map(({ term, definition, confidence }) => ({
    term,
    definition,
    confidence,
  }));

type TermVerificationWorkbenchProps = {
  readonly courseId: string;
  readonly verified: boolean;
  readonly reading: NotesReading | null;
  readonly existingTerms: ReadonlyArray<string>;
  readonly batchSession: BatchReviewSession | null;
  readonly batchIsLastPage: boolean;
  readonly busy: boolean;
  readonly pageImageSource: string;
  readonly onRetryReading: () => void;
  readonly onSubmit: (
    terms: ReadonlyArray<{
      readonly term: string;
      readonly definition: string;
    }>,
  ) => void;
};

// The photographed notes beside the terms read from them, so each line can
// be checked against the handwriting before it joins the subject.
export const TermVerificationWorkbench = ({
  courseId,
  verified,
  reading,
  existingTerms,
  batchSession,
  batchIsLastPage,
  busy,
  pageImageSource,
  onRetryReading,
  onSubmit,
}: TermVerificationWorkbenchProps) => (
  <div className="verification-workbench">
    <div className="verification-image-pane">
      <VerificationImage alt="Fotografierte Notizen" src={pageImageSource} />
    </div>
    <div className="verification-form-pane">
      {batchSession === null ? null : (
        <BatchReviewProgress
          position={batchSession.position + 1}
          total={batchSession.pageIds.length}
        />
      )}
      {verified ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">
            Die Begriffe dieser Seite sind schon eingetragen.
          </p>
          <ActionLink params={{ courseId }} to="/courses/$courseId">
            Zum Fach
          </ActionLink>
        </div>
      ) : null}
      {!verified && reading === null ? (
        <ExtractionRecovery busy={busy} onRetry={onRetryReading} />
      ) : null}
      {!verified && reading !== null ? (
        <TermReviewForm
          busy={busy}
          existingTerms={existingTerms}
          initialTerms={draftsFrom(reading)}
          key={reading.modelId + String(reading.notes.terms.length)}
          onSubmit={onSubmit}
          submitLabel={(termCount) =>
            submitLabel(termCount, batchSession, batchIsLastPage)
          }
        />
      ) : null}
    </div>
  </div>
);
