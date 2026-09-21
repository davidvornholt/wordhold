import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import { ManagedHeading } from '../../../shared/ui/managed-heading';

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
  <section className="flex animate-rise flex-col gap-6">
    <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
      {doneHeading(learned, directionLabel)}
    </ManagedHeading>
    {learned === 0 ? null : (
      <p className="text-muted-foreground">
        Diese Richtung ist jetzt zum Üben bereit.
      </p>
    )}
    {controls}
  </section>
);
