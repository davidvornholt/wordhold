// The ledger's columns, shared by its rows, its headings and the unit
// changes between runs so every line writes into the same columns: entry
// number, the word with its example, the German, and the row's actions. On
// narrow screens the German moves under the word.
export const ledgerGrid =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_5.5rem]';
