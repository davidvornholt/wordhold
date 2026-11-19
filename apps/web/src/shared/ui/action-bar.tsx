import type { ReactNode } from 'react';

type ActionBarProps = {
  // A quieter way out of the card, such as "Weiß ich nicht", or nothing.
  readonly secondary: ReactNode;
  // The one action that moves the card on. It keeps its place from
  // answering to continuing, so the hand does not move between the two.
  readonly primary: ReactNode;
};

// The row beneath a practice or learning card. It keeps its own
// view-transition group, so when a card is dealt the row slides to the next
// card's edge instead of fading with the page.
export const ActionBar = ({ secondary, primary }: ActionBarProps) => (
  <div className="practice-actions flex items-center justify-between gap-4">
    <div className="min-w-0 text-left">{secondary}</div>
    <div className="flex shrink-0 *:min-w-32 sm:*:min-w-40">{primary}</div>
  </div>
);
