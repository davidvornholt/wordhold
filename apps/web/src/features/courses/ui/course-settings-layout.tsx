import type { ReactNode } from 'react';

type CourseSettingsLayoutProps = {
  readonly backControl: ReactNode;
  readonly courseName: string;
  readonly children: ReactNode;
};

export const CourseSettingsLayout = ({
  backControl,
  courseName,
  children,
}: CourseSettingsLayoutProps) => (
  <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">
      {courseName}: Einstellungen
    </h1>
    {children}
  </main>
);
