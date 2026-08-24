import type { ReactNode } from 'react';

type PracticeLayoutProps = {
  readonly backControl: ReactNode;
  readonly courseName: string;
  readonly children: ReactNode;
};

export const PracticeLayout = ({
  backControl,
  courseName,
  children,
}: PracticeLayoutProps) => (
  <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">{courseName}: Üben</h1>
    {children}
  </main>
);

type PracticeEmptyProps = {
  readonly initialSession: boolean;
  readonly correct: number;
  readonly wrong: number;
  readonly backControl: ReactNode;
};

export const PracticeEmpty = ({
  initialSession,
  correct,
  wrong,
  backControl,
}: PracticeEmptyProps) => (
  <div className="flex flex-col gap-3 border border-border bg-card p-6">
    <p className="font-medium">
      {initialSession ? 'Gerade ist nichts fällig.' : 'Sitzung abgeschlossen!'}
    </p>
    {initialSession ? null : (
      <p className="text-sm">
        {correct} richtig, {wrong} falsch.
      </p>
    )}
    {backControl}
  </div>
);
