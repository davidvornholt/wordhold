import type { ReactNode } from 'react';

type ActionBarProps = {
  // The one action that moves the card on. It keeps its place and width from
  // answering to continuing, so the hand does not move between the two.
  readonly primary: ReactNode;
  // A quieter way out of the card, such as "Weiß ich nicht", or nothing.
  readonly secondary: ReactNode;
};

// The row at the foot of a practice or learning card: the main button first,
// where the eye ends after reading the card, and a text button beside it. On
// a phone the main button spans the card under the thumb, with the text
// button centred beneath it, as a row would not fit both.
export const ActionBar = ({ primary, secondary }: ActionBarProps) => (
  <div className="flex flex-col gap-1 pt-2 sm:flex-row sm:items-center sm:gap-2">
    <div className="flex *:flex-1 sm:*:min-w-40 sm:*:flex-none">{primary}</div>
    {secondary}
  </div>
);
