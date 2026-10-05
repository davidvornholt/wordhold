import type { Database } from '@wordhold/db/client';
import { Schema } from 'effect';
import { Uuid } from '../validate/uuid';

// The words of one place: a unit's, or the words that live directly in a
// book. A book's units are selected on their own.
export const PlaceSelection = Schema.Union([
  Schema.Struct({ bookId: Uuid }),
  Schema.Struct({ unitId: Uuid }),
]);

export type PlaceSelectionData = typeof PlaceSelection.Type;

export const VocabularySelection = Schema.Union([
  ...PlaceSelection.members,
  Schema.Struct({
    entryIds: Schema.Array(Uuid).check(Schema.isMinLength(1)),
  }),
]);

export type VocabularySelectionData = typeof VocabularySelection.Type;

// Matches the selected rows of `entries e`.
export const selectedEntries = (
  sql: Database,
  selection: VocabularySelectionData,
) => {
  if ('bookId' in selection) {
    return sql`e.book_id = ${selection.bookId} and e.unit_id is null`;
  }
  if ('unitId' in selection) {
    return sql`e.unit_id = ${selection.unitId}`;
  }
  return sql`e.id = any(${`{${selection.entryIds.join(',')}}`}::uuid[])`;
};
