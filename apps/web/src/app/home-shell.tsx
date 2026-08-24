import type { ReactNode } from 'react';

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
  <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
    <header className="flex items-baseline justify-between border-border border-b pb-5">
      <div>
        <h1 className="font-display font-semibold text-3xl">Wordhold</h1>
        <p className="text-muted-foreground text-sm" lang="en">
          From page to memory.
        </p>
      </div>
      {signedIn ? (
        <button
          className="text-muted-foreground text-sm underline"
          onClick={onSignOut}
          type="button"
        >
          Abmelden
        </button>
      ) : null}
    </header>
    {signedIn ? (
      children
    ) : (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground text-sm">
          Melde dich an, um deine Kurse zu sehen.
        </p>
        <button
          className="bg-primary px-4 py-2 text-primary-foreground text-sm"
          onClick={onSignIn}
          type="button"
        >
          Mit GitHub anmelden
        </button>
      </div>
    )}
  </main>
);
