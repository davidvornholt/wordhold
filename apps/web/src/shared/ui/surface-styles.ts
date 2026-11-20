/*
 * Card surfaces come in exactly two paddings: content cards (p-6) and
 * compact panels (p-4). List rows inside a cardListClass surface use
 * px-4 with py-3 or p-4 set at the row.
 */
export const cardClass = 'border border-border bg-card p-6';

export const cardCompactClass = 'border border-border bg-card p-4';

export const cardListClass =
  'divide-y divide-border border border-border bg-card';

// The practice card has no outline and no shadow, since the only lines on it
// are the ones an answer is written on. It stands out from the page by its
// tone alone, like a sheet of paper on a desk.
export const practiceCardClass = 'bg-card';
