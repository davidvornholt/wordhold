import type { ReactNode } from 'react';

type PageLayoutProps = {
  readonly backControl: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

// The shared page skeleton: back control and title anchored to the page
// column, content below in one vertical rhythm.
export const PageLayout = ({
  backControl,
  title,
  children,
}: PageLayoutProps) => (
  <main className="page-column flex flex-col gap-5 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">{title}</h1>
    {children}
  </main>
);
