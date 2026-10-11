import type { RowRemoval } from './draft-rows';

export const removalNotice = (removal: RowRemoval): string => {
  const term = removal.row.targetText.trim();
  return term === ''
    ? `Eintrag ${removal.index + 1} entfernt.`
    : `„${term}“ entfernt.`;
};
