import type { ReactNode } from 'react';

type AppShellProps = {
  // The wordmark as a link home; passed in so the shell needs no router.
  readonly home: ReactNode;
  readonly children: ReactNode;
};

// The home shell: a persistent top bar over the page. Pages render their own
// <main>. Focus screens (practice, learning) opt out and render without it.
export const AppShell = ({ home, children }: AppShellProps) => (
  <>
    <header className="app-header border-border border-b">
      <div className="page-column flex min-h-14 items-center justify-between gap-4 px-6">
        {home}
      </div>
    </header>
    {children}
  </>
);
