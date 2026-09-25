import { BatchReviewProgress } from '../src/features/import/ui/batch-review-progress';
import { VerificationImage } from '../src/features/import/ui/verification-image';
import { VerifyForm } from '../src/features/import/ui/verify-form';
import { navigateToFixture } from './fixture-state';
import {
  photographedPage,
  verificationBooks,
  verificationEntries,
  verificationUnits,
} from './verification-fixture-data';

type BatchReviewFixtureProps = {
  readonly position: 1 | 2;
};

// The last page of a batch returns to the overview like a single page does.
const nextState = (position: 1 | 2) =>
  position === 1
    ? ('verification-batch-second' as const)
    : ('dashboard' as const);

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
          books={verificationBooks}
          busy={false}
          existingEntries={[]}
          generateExample={async () => ({
            target: 'This memory makes me smile.',
            native: 'Diese Erinnerung bringt mich zum Lächeln.',
          })}
          translateExample={async () => ({ native: 'Übersetzt.' })}
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
