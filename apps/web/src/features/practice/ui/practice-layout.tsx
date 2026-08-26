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
  readonly total: number;
  readonly correct: number;
  readonly wrong: number;
  readonly backControl: ReactNode;
};

// The end of the session. Every card that was missed came back and was
// answered, so the tally is per card, not per attempt: how many were right
// straight away, and how many needed a second go.
export const PracticeEmpty = ({
  total,
  correct,
  wrong,
  backControl,
}: PracticeEmptyProps) => (
  <div className="flex flex-col gap-3 border border-border bg-card p-6">
    <p className="font-medium">
      {total === 0 ? 'Gerade ist nichts fällig.' : 'Sitzung abgeschlossen!'}
    </p>
    {total === 0 ? null : (
      <p className="text-sm">
        {correct} von {total} Karten auf Anhieb richtig
        {wrong === 0 ? '.' : `, ${wrong} noch einmal geübt.`}
      </p>
    )}
    {backControl}
  </div>
);
