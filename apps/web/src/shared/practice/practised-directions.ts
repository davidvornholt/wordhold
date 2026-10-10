import type { Database } from '@wordhold/db/client';

// The card directions a course asks: the translation directions it has
// switched on, and synonyms and antonyms while a language course practises
// them. A word has a synonym or antonym card only while it has that list, so
// the words without one are not affected.
//
// The surrounding query must name the course `co`.
export const practisedDirections = (sql: Database) => sql`(
  co.directions || case
    when co.kind = 'language' and co.practises_related_words
      then '{to_synonym,to_antonym}'::answer_direction[]
    else '{}'::answer_direction[]
  end
)`;

// The words a synonym or antonym card asks for, in their stored order; empty
// for a translation card.
//
// The surrounding query must name the card `c` and its entry `e`.
export const cardRelatedWords = (sql: Database) => sql`coalesce(
  case c.direction
    when 'to_synonym' then e.synonyms
    when 'to_antonym' then e.antonyms
  end,
  '{}'::text[]
)`;
