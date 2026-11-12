export const editedEntryIds = (
  current: ReadonlyArray<string>,
  added: ReadonlyArray<string>,
  removed: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const left = new Set(removed);
  return [...new Set([...current, ...added])].filter((id) => !left.has(id));
};
