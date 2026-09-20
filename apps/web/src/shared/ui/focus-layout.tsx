import type { ReactNode } from 'react';

type FocusLayoutProps = {
  // The one way out, rendered through BackLink or its fixture stand-in.
  readonly exit: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

// The focus shell for one task at a time: no top bar, a narrow column, the
// exit and the page title reduced to a single quiet row. Content is anchored
// to the top rather than centred: the card grows downward when the answer is
// revealed, so the word never moves at the moment of judgment.
export const FocusLayout = ({ exit, title, children }: FocusLayoutProps) => (
  <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 px-5 pt-3 pb-8 sm:gap-8 sm:pt-5">
    <header className="flex items-center justify-between gap-4">
      {exit}
      <h1 className="truncate text-muted-foreground text-sm">{title}</h1>
    </header>
    <div className="flex flex-col gap-6 pt-4 sm:pt-10">{children}</div>
  </main>
);
