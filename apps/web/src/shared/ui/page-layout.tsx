import type { ReactNode } from 'react';

type PageLayoutProps = {
  readonly backControl: ReactNode;
  readonly title: string;
  // A small control for the page's subject as a whole, such as its
  // settings, set beside the title so it stays out of the page's actions.
  readonly titleAction?: ReactNode;
  readonly children: ReactNode;
};

// The shared page skeleton: back control and title anchored to the page
// column, content below in one vertical rhythm.
export const PageLayout = ({
  backControl,
  title,
  titleAction,
  children,
}: PageLayoutProps) => (
  <main className="page-column flex flex-col gap-5 p-6">
    {backControl}
    {titleAction === undefined ? (
      <h1 className="font-display font-semibold text-2xl">{title}</h1>
    ) : (
      // The 44px control overlaps the title's 32px line, so the title sits
      // where it does on every other page.
      <div className="flex items-start gap-1">
        <h1 className="min-w-0 break-words font-display font-semibold text-2xl">
          {title}
        </h1>
        <div className="-my-1.5 shrink-0">{titleAction}</div>
      </div>
    )}
    {children}
  </main>
);
