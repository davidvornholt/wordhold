import type { ReactNode } from 'react';
import type { CourseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';

type VocabularySelectionBarProps = {
  readonly count: number;
  readonly nouns: CourseNouns;
  readonly children: ReactNode;
};

// Floats above the list edge while a selection exists, so the study action
// stays reachable however long the list grows.
export const VocabularySelectionBar = ({
  count,
  nouns,
  children,
}: VocabularySelectionBarProps) => (
  <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border border-primary bg-card p-4 shadow-lg">
    <p className="font-medium">
      {countNoun(count, nouns.singular, nouns.plural)} ausgewählt
    </p>
    {children}
  </div>
);
