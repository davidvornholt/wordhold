import { useSyncExternalStore } from 'react';
import { Button } from '../../../shared/ui/button';

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
  readonly busyLabel: string;
  readonly submittable: boolean;
  readonly submitLabel: string;
  // What the submit leaves out or still waits for, if anything.
  readonly status: string | null;
  readonly removalNotice: string | null;
};

// Closes the ledger. Its status line also announces a removal, which the
// ledger shows in the removed entry's place.
export const VerifyActionBar = ({
  busy,
  busyLabel,
  submittable,
  submitLabel,
  status,
  removalNotice,
}: VerifyActionBarProps) => {
  const apple = useApplePlatform();
  const label = busy ? busyLabel : submitLabel;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-muted-foreground text-sm" role="status">
        {removalNotice === null ? null : (
          <span className="sr-only">{removalNotice} </span>
        )}
        {status}
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
