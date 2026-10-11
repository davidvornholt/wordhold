// Marks AI text the learner has not reviewed yet. The checklist above the
// ledger explains the mark; each marked field carries the explanation for
// screen readers, so the mark itself stays out of the accessibility tree.
export const AiBadge = () => (
  <span
    aria-hidden={true}
    className="shrink-0 border border-primary/40 px-1 font-medium text-[0.625rem] text-primary leading-4 tracking-wider"
  >
    KI
  </span>
);
