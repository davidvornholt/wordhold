import type { ReactNode } from 'react';
import { ManagedFocusHeading } from './managed-focus-heading';

type LearnDoneProps = {
  readonly learned: number;
  readonly practiceControl: ReactNode;
};

export const LearnDone = ({ learned, practiceControl }: LearnDoneProps) => (
  <div className="flex flex-col gap-3 border border-border bg-card p-6">
    <ManagedFocusHeading className="font-medium">
      {learned === 0
        ? 'In dieser Einheit gibt es nichts mehr zu lernen.'
        : 'Einheit gelernt!'}
    </ManagedFocusHeading>
    {learned === 0 ? null : (
      <p className="text-sm">{learned} Wörter zählen ab jetzt beim Üben mit.</p>
    )}
    {practiceControl}
  </div>
);
