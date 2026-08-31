import type { ReactNode } from 'react';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import { cardClass } from '../../../shared/ui/surface-styles';

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
  <div className={`flex flex-col gap-3 ${cardClass}`}>
    <ManagedHeading className="font-display text-xl">
      {doneHeading(learned)}
    </ManagedHeading>
    {learned === 0 ? null : (
      <p className="text-sm">
        Die Karten sind jetzt für ihre erste Abfrage bereit.
      </p>
    )}
    {practiceControl}
  </div>
);
