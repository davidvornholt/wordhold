import type { ReactNode } from 'react';

type HomeShellProps = {
  readonly signedIn: boolean;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  readonly navigation: ReactNode;
  readonly children: ReactNode;
};

export const HomeShell = ({
  signedIn,
  onSignIn,
  onSignOut,
  navigation,
  children,
}: HomeShellProps) => (
  <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
    <header className="flex items-baseline justify-between">
      <div>
        <h1 className="font-semibold text-2xl">Wordhold</h1>
        <p className="text-neutral-500 text-sm" lang="en">
          From page to memory.
        </p>
      </div>
      {signedIn ? (
        <button
          className="text-neutral-500 text-sm underline"
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
        <p className="text-neutral-600 text-sm">
          Melde dich an, um deine Kurse zu sehen.
        </p>
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          onClick={onSignIn}
          type="button"
        >
          Mit GitHub anmelden
        </button>
      </div>
    )}
    <nav className="flex gap-4 border-neutral-200 border-t pt-4">
      {navigation}
    </nav>
  </main>
);
