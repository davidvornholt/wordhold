import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';

type VocabularySelectionBarProps = {
  readonly count: number;
  readonly children: ReactNode;
};

// Floats above the list edge while a selection exists, so the study action
// stays reachable however long the list grows.
export const VocabularySelectionBar = ({
  count,
  children,
}: VocabularySelectionBarProps) => (
  <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border border-primary bg-card p-4 shadow-lg">
    <p className="font-medium">
      {countNoun(count, 'Vokabel', 'Vokabeln')} ausgewählt
    </p>
    {children}
  </div>
);
