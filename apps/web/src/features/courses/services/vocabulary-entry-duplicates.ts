import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import {
  type ExistingEntry,
  findDuplicate,
} from '../../../shared/vocabulary/entry-identity';

type CourseEntryRow = {
  readonly id: string;
  readonly targetText: string;
  readonly example: string | null;
  readonly bookName: string;
  readonly unitName: string | null;
};

type LocatedEntry = ExistingEntry & { readonly location: string };

const groupCourseEntries = (
  rows: ReadonlyArray<CourseEntryRow>,
): ReadonlyArray<LocatedEntry> => {
  const byEntry = new Map<
    string,
    {
      readonly targetText: string;
      readonly location: string;
      examples: Array<string>;
    }
  >();
  for (const row of rows) {
    const entry = byEntry.get(row.id) ?? {
      targetText: row.targetText,
      location: wordLocation(row.bookName, row.unitName),
      examples: [],
    };
    if (row.example !== null) {
      entry.examples.push(row.example);
    }
    byEntry.set(row.id, entry);
  }
  return [...byEntry.values()];
};

// The stored word of the course, in any book, that a typed or corrected word
// repeats. A corrected word is not compared with itself. Runs inside the
// caller's transaction, under the per-course lock.
export const findCourseDuplicate = (
  sql: Database,
  courseId: string,
  draft: { readonly targetText: string; readonly example: string },
  correctedEntryId: string | null,
) =>
  sql<CourseEntryRow>`
    select e.id, e.target_text as "targetText",
      x.target_text as example,
      b.name as "bookName", u.name as "unitName"
    from entries e
    join books b on b.id = e.book_id
    left join units u on u.id = e.unit_id
    left join entry_examples x on x.entry_id = e.id
    where e.course_id = ${courseId}
      and (${correctedEntryId}::uuid is null or e.id <> ${correctedEntryId}::uuid)
  `.pipe(Effect.map((rows) => findDuplicate(draft, groupCourseEntries(rows))));
