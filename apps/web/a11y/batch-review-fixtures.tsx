import { BatchReviewComplete } from '../src/features/import/ui/batch-review-complete';
import { BatchReviewProgress } from '../src/features/import/ui/batch-review-progress';
import { VerificationImage } from '../src/features/import/ui/verification-image';
import { VerifyForm } from '../src/features/import/ui/verify-form';
import { navigateToFixture } from './fixture-state';
import {
  photographedPage,
  verificationEntries,
  verificationUnits,
} from './verification-fixture-data';

type BatchReviewFixtureProps = {
  readonly position: 1 | 2;
  readonly skippedBefore?: 0 | 1;
};

const nextState = (
  position: 1 | 2,
  skipped: number,
):
  | 'verification-batch-second'
  | 'verification-batch-second-deferred'
  | 'verification-batch-complete'
  | 'verification-batch-complete-deferred'
  | 'verification-batch-complete-all-deferred' => {
  if (position === 1) {
    return skipped === 0
      ? 'verification-batch-second'
      : 'verification-batch-second-deferred';
  }
  if (skipped === 0) {
    return 'verification-batch-complete';
  }
  return skipped === 1
    ? 'verification-batch-complete-deferred'
    : 'verification-batch-complete-all-deferred';
};

export const BatchReviewFixture = ({
  position,
  skippedBefore = 0,
}: BatchReviewFixtureProps) => (
  <main className="verification-screen">
    <div className="verification-header">
      <button
        className="text-muted-foreground text-sm underline"
        onClick={() => navigateToFixture('import-session')}
        type="button"
      >
        ← Zum Seitenstapel
      </button>
      <h1 className="font-display font-semibold text-2xl">
        English A2: Seite überprüfen
      </h1>
    </div>
    <div className="verification-workbench">
      <div className="verification-image-pane">
        <VerificationImage src={photographedPage} />
      </div>
      <div className="verification-form-pane">
        <BatchReviewProgress
          actionLabel="Diese Seite später prüfen"
          busy={false}
          onAction={() =>
            navigateToFixture(nextState(position, skippedBefore + 1))
          }
          position={position}
          total={2}
        />
        <VerifyForm
          busy={false}
          initialEntries={verificationEntries}
          initialUnitName="Unit 2"
          onSubmit={() => navigateToFixture(nextState(position, skippedBefore))}
          submitLabel={(entryCount) =>
            position === 1
              ? `${entryCount} Einträge importieren und weiter`
              : `${entryCount} Einträge importieren`
          }
          targetLabel="Englisch"
          units={verificationUnits}
        />
      </div>
    </div>
  </main>
);

type BatchReviewCompleteFixtureProps = {
  readonly skipped?: 0 | 1 | 2;
};

export const BatchReviewCompleteFixture = ({
  skipped = 0,
}: BatchReviewCompleteFixtureProps) => (
  <main className="verification-screen">
    <div className="verification-header">
      <button
        className="text-muted-foreground text-sm underline"
        onClick={() => navigateToFixture('import-session')}
        type="button"
      >
        ← Zum Seitenstapel
      </button>
      <h1 className="font-display font-semibold text-2xl">
        English A2: Seiten geprüft
      </h1>
    </div>
    <BatchReviewComplete
      imported={2 - skipped}
      overviewAction={
        <button
          className="inline-flex min-h-11 items-center bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => navigateToFixture('import-session')}
          type="button"
        >
          Zum Seitenstapel
        </button>
      }
      skipped={skipped}
      total={2}
    />
  </main>
);
