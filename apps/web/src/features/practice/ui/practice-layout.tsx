import type { ReactNode } from 'react';

type PracticeLayoutProps = {
  readonly backControl: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
};

export const PracticeLayout = ({
  backControl,
  title,
  children,
}: PracticeLayoutProps) => (
  <main className="page-column flex flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">{title}</h1>
    {children}
  </main>
);

type PracticeEmptyProps = {
  readonly total: number;
  readonly correct: number;
  readonly wrong: number;
  readonly emptyMessage: string;
  readonly ungraded: number;
  readonly backControl: ReactNode;
};

const sessionHeading = (total: number, ungraded: number) => {
  if (total === 0) {
    return 'Gerade ist nichts fällig.';
  }
  return ungraded === 0 ? 'Sitzung abgeschlossen!' : 'Sitzung beendet.';
};

// The end of the session. The tally is per card, not per attempt. A provider
// failure is its own outcome because that card remains due.
export const PracticeEmpty = ({
  total,
  correct,
  wrong,
  emptyMessage,
  ungraded,
  backControl,
}: PracticeEmptyProps) => (
  <div className="flex flex-col gap-3 border border-border bg-card p-6">
    <p className="font-medium">
      {total === 0 ? emptyMessage : sessionHeading(total, ungraded)}
    </p>
    {total === 0 ? null : (
      <p className="text-sm">
        {correct} von {total} Karten auf Anhieb richtig
        {wrong === 0 ? '.' : `, ${wrong} noch einmal geübt.`}
      </p>
    )}
    {ungraded === 0 ? null : (
      <p className="border-warning-foreground border-l-4 bg-warning p-3 text-sm">
        {ungraded === 1
          ? '1 Karte konnte nicht bewertet werden und bleibt fällig.'
          : `${ungraded} Karten konnten nicht bewertet werden und bleiben fällig.`}
      </p>
    )}
    {backControl}
  </div>
);
