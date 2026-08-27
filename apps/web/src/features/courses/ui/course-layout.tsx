import type { ReactNode } from 'react';

type CourseLayoutProps = {
  readonly backControl: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

export const CourseLayout = ({
  backControl,
  title,
  children,
}: CourseLayoutProps) => (
  <main className="page-column flex flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">{title}</h1>
    {children}
  </main>
);
