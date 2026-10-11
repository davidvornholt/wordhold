import { useSyncExternalStore } from 'react';
import { Button } from '../../../shared/ui/button';
import type { RowRemoval } from './draft-rows';
import { removalNotice } from './removal-notice';
import { skippedSummary } from './verify-form-selection';

const subscribeToNothing = () => () => undefined;

const applePlatform = /Mac|iPhone|iPad/u;

// The platform never changes while the page is open. The server renders the
// Windows and Linux hint, and Apple devices swap in theirs after hydration.
const useApplePlatform = (): boolean =>
  useSyncExternalStore(
    subscribeToNothing,
    () => applePlatform.test(globalThis.navigator.userAgent),
    () => false,
  );

type VerifyActionBarProps = {
  readonly busy: boolean;
  readonly submittable: boolean;
  readonly submitLabel: string;
  readonly skipped: number;
  readonly removal: RowRemoval | null;
};

// Closes the ledger. Its status line also announces a removal, which the
// ledger shows in the removed entry's place.
export const VerifyActionBar = ({
  busy,
  submittable,
  submitLabel,
  skipped,
  removal,
}: VerifyActionBarProps) => {
  const apple = useApplePlatform();
  const label = busy ? 'Importiere …' : submitLabel;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-muted-foreground text-sm" role="status">
        {removal === null ? null : (
          <span className="sr-only">{removalNotice(removal)} </span>
        )}
        {skipped > 0 ? skippedSummary(skipped) : null}
      </p>
      <Button
        aria-keyshortcuts="Control+Enter Meta+Enter"
        className="ml-auto"
        disabled={!submittable}
        type="submit"
      >
        {label}
        <span
          aria-hidden={true}
          className="pointer-fine:inline hidden border border-primary-foreground/40 px-1 text-primary-foreground text-xs"
        >
          {apple ? '⌘ ↵' : 'Strg ↵'}
        </span>
      </Button>
    </div>
  );
};
