import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import { cardClass } from '../../../shared/ui/surface-styles';

type LearnDoneProps = {
  readonly learned: number;
  readonly directionLabel: string | null;
  readonly controls: ReactNode;
};

const doneHeading = (learned: number, direction: string | null): string => {
  if (learned === 0) {
    return 'In dieser Einheit gibt es keine offene Abfragerichtung.';
  }
  const count = countNoun(learned, 'Vokabel', 'Vokabeln');
  return direction === null
    ? `${count} kennengelernt`
    : `${count} für ${direction} kennengelernt`;
};

export const LearnDone = ({
  learned,
  directionLabel,
  controls,
}: LearnDoneProps) => (
  <div className={`flex flex-col gap-3 ${cardClass}`}>
    <ManagedHeading className="font-display text-xl">
      {doneHeading(learned, directionLabel)}
    </ManagedHeading>
    {learned === 0 ? null : (
      <p className="text-sm">Diese Richtung ist jetzt zum Üben bereit.</p>
    )}
    {controls}
  </div>
);
