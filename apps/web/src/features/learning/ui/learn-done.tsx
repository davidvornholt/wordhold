import type { ReactNode } from 'react';
import { ManagedFocusHeading } from './managed-focus-heading';

type LearnDoneProps = {
  readonly learned: number;
  readonly practiceControl: ReactNode;
};

const doneHeading = (learned: number): string => {
  if (learned === 0) {
    return 'In dieser Einheit gibt es keine offene Abfragerichtung.';
  }
  if (learned === 1) {
    return 'Eine Abfragerichtung kennengelernt';
  }
  return `${learned} Abfragerichtungen kennengelernt`;
};

export const LearnDone = ({ learned, practiceControl }: LearnDoneProps) => (
  <div className="flex flex-col gap-3 border border-border bg-card p-6">
    <ManagedFocusHeading className="font-display text-xl">
      {doneHeading(learned)}
    </ManagedFocusHeading>
    {learned === 0 ? null : (
      <p className="text-sm">
        Die Karten sind jetzt für ihre erste Abfrage bereit.
      </p>
    )}
    {practiceControl}
  </div>
);
