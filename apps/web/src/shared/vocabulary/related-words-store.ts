import type { Database } from '@wordhold/db/client';
import type { RelatedWordListsData } from './related-words';

export type RelatedWordsWrite = RelatedWordListsData & {
  readonly courseId: string;
  readonly entryId: string;
};

// Sets both lists of each word in one statement, a null list as null. Only
// words of the named course change; resolves to the ids written. The lists
// travel as one JSON parameter, as key points do.
export const writeRelatedWords = (
  sql: Database,
  writes: ReadonlyArray<RelatedWordsWrite>,
) =>
  sql<{ readonly id: string }>`
    update entries e
    set synonyms = case when r.synonyms is null then null
          else array(select jsonb_array_elements_text(r.synonyms)) end,
        antonyms = case when r.antonyms is null then null
          else array(select jsonb_array_elements_text(r.antonyms)) end
    from jsonb_to_recordset(${JSON.stringify(writes)}::jsonb)
      as r("courseId" uuid, "entryId" uuid, synonyms jsonb, antonyms jsonb)
    where e.id = r."entryId" and e.course_id = r."courseId"
    returning e.id
  `;
