import type { ReactNode } from 'react';
import type { CourseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { ManagedHeading } from '../../../shared/ui/managed-heading';

type LearnDoneProps = {
  readonly learned: number;
  readonly directionLabel: string | null;
  readonly nouns: CourseNouns;
  readonly controls: ReactNode;
};

const doneHeading = (
  learned: number,
  direction: string | null,
  nouns: CourseNouns,
): string => {
  if (learned === 0) {
    return 'In dieser Einheit gibt es keine offene Abfragerichtung.';
  }
  const count = countNoun(learned, nouns.singular, nouns.plural);
  return direction === null
    ? `${count} kennengelernt`
    : `${count} für ${direction} kennengelernt`;
};

export const LearnDone = ({
  learned,
  directionLabel,
  nouns,
  controls,
}: LearnDoneProps) => (
  <section className="flex animate-rise flex-col gap-6">
    <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
      {doneHeading(learned, directionLabel, nouns)}
    </ManagedHeading>
    {learned === 0 ? null : (
      <p className="text-muted-foreground">
        {directionLabel === null
          ? 'Du kannst jetzt üben.'
          : 'Diese Richtung ist jetzt zum Üben bereit.'}
      </p>
    )}
    {controls}
  </section>
);
