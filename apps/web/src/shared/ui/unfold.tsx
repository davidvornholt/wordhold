import type { ReactNode } from 'react';

// A part of a card that unfolds when it appears, so the card grows smoothly
// and what is below it slides down rather than jumping. The inner box clips
// while it unfolds and keeps a little room for focus rings.
export const Unfold = ({ children }: { readonly children: ReactNode }) => (
  <div className="grid grid-rows-[1fr] starting:grid-rows-[0fr] transition-[grid-template-rows] duration-(--motion-slow)">
    <div className="-m-1 min-h-0 overflow-hidden p-1">{children}</div>
  </div>
);
