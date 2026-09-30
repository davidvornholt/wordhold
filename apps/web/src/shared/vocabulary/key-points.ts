import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';

// Stores key points derived for a definition, unless the definition changed
// or key points were set in the meantime. Resolves to the key points the
// entry now has, or null when the definition changed. Practice derives them
// on the first judged answer, the entry form right after saving.
//
// The read is a separate statement: an update that waited for another
// request's write skips the row, and only a later statement sees what that
// request stored.
export const saveDerivedKeyPoints = (
  sql: Database,
  entryId: string,
  definition: string,
  keyPoints: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const [updated] = yield* sql<{
      readonly keyPoints: ReadonlyArray<string>;
    }>`
      update entries
      set key_points = array(
        select jsonb_array_elements_text(${JSON.stringify(keyPoints)}::jsonb)
      )
      where id = ${entryId} and native_text = ${definition}
        and key_points is null
      returning key_points as "keyPoints"
    `;
    if (updated !== undefined) {
      return updated.keyPoints;
    }
    const [current] = yield* sql<{
      readonly keyPoints: ReadonlyArray<string> | null;
    }>`
      select key_points as "keyPoints" from entries
      where id = ${entryId} and native_text = ${definition}
    `;
    return current?.keyPoints ?? null;
  });
