import type { Database } from '@wordhold/db/client';

// Whether an entry counts as "sicher": every translation direction its course
// still practises has a card in the review state, so a missing card counts as
// not known. While the course practises synonyms and antonyms, the entry's
// cards for them must be in the review state too; a word without such a list
// has no such card. The dashboard counts these entries and the practice
// summary reports the ones a sitting added, so both read this one definition.
//
// The surrounding query must name the entry `e` and its course `co`.
export const entryIsKnown = (sql: Database) => sql`(not exists (
  select 1
  from unnest(co.directions) as known_direction(direction)
  left join cards known_card on known_card.entry_id = e.id
    and known_card.direction = known_direction.direction
  where known_card.state is distinct from 'review'
) and not exists (
  select 1
  from cards related_card
  where co.practises_related_words
    and related_card.entry_id = e.id
    and related_card.direction in ('to_synonym', 'to_antonym')
    and related_card.state <> 'review'
))`;
