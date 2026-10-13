import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';

// Postgres reads the ids as one array parameter.
const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

// A synonym or antonym card has no learning pass of its own. It is asked as
// soon as its word has been learned or skipped in a translation direction,
// stamped with when the word was first met. While it has not been answered,
// it goes back with the word once no translation direction is introduced any
// more. The database migration applies the same rule to every card. Runs
// inside the caller's transaction.
export const syncRelationIntroduction = (
  sql: Database,
  entryIds: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    if (entryIds.length === 0) {
      return;
    }
    const ids = uuidArray([...new Set(entryIds)]);
    yield* sql`
      update cards r set introduced_at = met.introduced_at
      from (
        select entry_id, min(introduced_at) as introduced_at
        from cards
        where entry_id = any(${ids}::uuid[])
          and direction in ('to_target', 'to_native')
          and introduced_at is not null
        group by entry_id
      ) met
      where r.entry_id = met.entry_id
        and r.direction in ('to_synonym', 'to_antonym')
        and r.introduced_at is null
    `;
    yield* sql`
      update cards r set introduced_at = null
      where r.entry_id = any(${ids}::uuid[])
        and r.direction in ('to_synonym', 'to_antonym')
        and r.introduced_at is not null
        and r.state = 'new'
        and not exists (
          select 1 from cards t
          where t.entry_id = r.entry_id
            and t.direction in ('to_target', 'to_native')
            and t.introduced_at is not null
        )
    `;
  });
