import type { ReactNode } from 'react';
import { navigateToFixture } from './fixture-state';

export const FixtureShell = ({
  children,
  signedIn = true,
}: {
  readonly children: ReactNode;
  readonly signedIn?: boolean;
}) => (
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
          onClick={() => navigateToFixture('signed-out')}
          type="button"
        >
          Abmelden
        </button>
      ) : null}
    </header>
    {children}
  </main>
);
