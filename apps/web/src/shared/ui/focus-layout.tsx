import type { ReactNode } from 'react';

type FocusLayoutProps = {
  // The one way out, rendered through BackLink or its fixture stand-in.
  readonly exit: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

// The focus shell for one task at a time: no top bar, a narrow column, the
// exit and the page title reduced to a single quiet row, and the content
// centred in the viewport so the card is what the eye lands on.
export const FocusLayout = ({ exit, title, children }: FocusLayoutProps) => (
  <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 px-5 pt-3 pb-8 sm:gap-8 sm:pt-5">
    <header className="flex items-center justify-between gap-4">
      {exit}
      <h1 className="truncate text-muted-foreground text-sm">{title}</h1>
    </header>
    <div className="flex flex-1 flex-col justify-center gap-6">{children}</div>
  </main>
);
