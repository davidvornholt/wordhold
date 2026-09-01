import type { ReactNode } from 'react';
import { Button } from '../shared/ui/button';

type HomeShellProps = {
  readonly signedIn: boolean;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  readonly children: ReactNode;
};

export const HomeShell = ({
  signedIn,
  onSignIn,
  onSignOut,
  children,
}: HomeShellProps) => (
  <main className="page-column flex flex-col gap-8 p-6">
    <header className="flex items-baseline justify-between border-border border-b pb-5">
      <div>
        <h1 className="font-display font-semibold text-3xl">Wordhold</h1>
        <p className="text-muted-foreground text-sm" lang="en">
          From page to memory.
        </p>
      </div>
      {signedIn ? (
        <Button onClick={onSignOut} variant="quiet-muted">
          Abmelden
        </Button>
      ) : null}
    </header>
    {signedIn ? (
      children
    ) : (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground text-sm">
          Melde dich an, um deine Kurse zu sehen.
        </p>
        <Button onClick={onSignIn}>Mit GitHub anmelden</Button>
      </div>
    )}
  </main>
);
