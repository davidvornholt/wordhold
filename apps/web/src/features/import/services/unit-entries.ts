import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import type { UnitEntry } from './repository';

type UnitEntryRow = {
  readonly id: string;
  readonly bookName: string;
  readonly unitName: string | null;
  readonly targetText: string;
  readonly example: string | null;
};

const groupUnitEntryRows = (
  rows: ReadonlyArray<UnitEntryRow>,
): ReadonlyArray<UnitEntry> => {
  const byEntry = new Map<
    string,
    {
      readonly location: string;
      readonly targetText: string;
      examples: Array<string>;
    }
  >();
  for (const row of rows) {
    const entry = byEntry.get(row.id) ?? {
      location: wordLocation(row.bookName, row.unitName),
      targetText: row.targetText,
      examples: [],
    };
    if (row.example !== null) {
      entry.examples.push(row.example);
    }
    byEntry.set(row.id, entry);
  }
  return [...byEntry.values()];
};

// One row per (entry, example) pair, regrouped in code: the duplicate rule
// needs every stored example sentence next to its word, whichever source
// added it.
export const selectUnitEntries = (sql: Database, courseId: string) =>
  sql<UnitEntryRow>`
    select entries.id,
      books.name as "bookName",
      units.name as "unitName",
      entries.target_text as "targetText",
      entry_examples.target_text as "example"
    from entries
    join books on books.id = entries.book_id
    left join units on units.id = entries.unit_id
    left join entry_examples on entry_examples.entry_id = entries.id
    where entries.course_id = ${courseId}
    order by entries.created_at, entries.id
  `.pipe(Effect.map(groupUnitEntryRows));
