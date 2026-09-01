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
};

const nextState = (position: 1 | 2) =>
  position === 1
    ? ('verification-batch-second' as const)
    : ('verification-batch-complete' as const);

export const BatchReviewFixture = ({ position }: BatchReviewFixtureProps) => (
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
        <BatchReviewProgress position={position} total={2} />
        <VerifyForm
          busy={false}
          existingEntries={[]}
          generateExample={async () => ({
            target: 'This memory makes me smile.',
            native: 'Diese Erinnerung bringt mich zum Lächeln.',
          })}
          initialEntries={verificationEntries}
          initialUnitName="Unit 2"
          onSubmit={() => navigateToFixture(nextState(position))}
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

export const BatchReviewCompleteFixture = () => (
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
      overviewAction={
        <button
          className="inline-flex min-h-11 items-center bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => navigateToFixture('import-session')}
          type="button"
        >
          Zum Seitenstapel
        </button>
      }
      total={2}
    />
  </main>
);
