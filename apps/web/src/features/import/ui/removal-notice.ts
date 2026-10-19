import type { RowRemoval } from './draft-rows';
import type { TermRemoval } from './term-draft-rows';

// What the ledger and its status line say about the removed row: its text,
// or its place in the ledger when it had none.
const removalNotice = (text: string, place: string): string => {
  const trimmed = text.trim();
  return trimmed === '' ? `${place} entfernt.` : `„${trimmed}“ entfernt.`;
};

export const entryRemovalNotice = (removal: RowRemoval): string =>
  removalNotice(removal.row.targetText, `Eintrag ${removal.index + 1}`);

export const termRemovalNotice = (removal: TermRemoval): string =>
  removalNotice(removal.row.term, `Begriff ${removal.index + 1}`);
