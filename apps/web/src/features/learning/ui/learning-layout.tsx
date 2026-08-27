import type { ReactNode } from 'react';

type LearningLayoutProps = {
  readonly backControl: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

export const LearningLayout = ({
  backControl,
  title,
  children,
}: LearningLayoutProps) => (
  <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">{title}</h1>
    {children}
  </main>
);
