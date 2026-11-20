/*
 * Card surfaces come in exactly two paddings: content cards (p-6) and
 * compact panels (p-4). List rows inside a cardListClass surface use
 * px-4 with py-3 or p-4 set at the row.
 */
export const cardClass = 'border border-border bg-card p-6';

export const cardCompactClass = 'border border-border bg-card p-4';

export const cardListClass =
  'divide-y divide-border border border-border bg-card';

// The practice card has no outline, since the only lines on it are the ones
// an answer is written on. It stands out from the page by its tone, and in
// light mode, where the tones are close, by a soft shadow as well.
export const practiceCardClass =
  'bg-card shadow-[0_1px_2px_oklch(0_0_0/0.05),0_12px_32px_-12px_oklch(0_0_0/0.12)] dark:shadow-none';
