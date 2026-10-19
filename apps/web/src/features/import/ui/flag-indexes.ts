// The rows a checklist flag jumps between, in ledger order.
export const indexesWhere = <T>(
  items: ReadonlyArray<T>,
  matches: (item: T, index: number) => boolean,
): ReadonlyArray<number> =>
  items.flatMap((item, index) => (matches(item, index) ? [index] : []));
