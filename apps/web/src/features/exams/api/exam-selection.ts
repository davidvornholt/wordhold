/**
 * A test's words after an edit. Additions come first and removals after, so
 * a word removed from a unit added in the same edit stays out.
 */
export const editedEntryIds = (
  current: ReadonlyArray<string>,
  added: ReadonlyArray<string>,
  removed: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const left = new Set(removed);
  return [...new Set([...current, ...added])].filter((id) => !left.has(id));
};
