import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../grading/normalize';
import type { RelatedWordListsData } from './related-words';

export type RelatedWordsWrite = RelatedWordListsData & {
  readonly courseId: string;
  readonly entryId: string;
};

type WrittenRow = { readonly id: string };

const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

// Each listed word is a textbook answer of its card, so a typed synonym or
// antonym is graded without the judge.
const relationAnswers = (writes: ReadonlyArray<RelatedWordsWrite>) =>
  writes.flatMap((write) =>
    (
      [
        ['to_synonym', write.synonyms],
        ['to_antonym', write.antonyms],
      ] as const
    ).flatMap(([direction, words]) =>
      (words ?? []).map((text) => ({
        entryId: write.entryId,
        direction,
        text,
        normalized: normalizeAnswer(text),
        source: 'textbook',
      })),
    ),
  );

// A word has a synonym card while it has synonyms, and an antonym card while
// it has antonyms. An emptied list takes its card, with the card's schedule
// and the alternatives the judge accepted for it; a changed list keeps the
// card and replaces its textbook answers.
const syncRelationCards = (
  sql: Database,
  writes: ReadonlyArray<RelatedWordsWrite>,
) =>
  Effect.gen(function* () {
    const ids = uuidArray(writes.map((write) => write.entryId));
    yield* sql`
      with emptied as (
        select e.id as entry_id, d.direction
        from entries e
        cross join lateral (values
          ('to_synonym'::answer_direction, e.synonyms),
          ('to_antonym'::answer_direction, e.antonyms)
        ) as d(direction, words)
        where e.id = any(${ids}::uuid[])
          and coalesce(cardinality(d.words), 0) = 0
      ), removed_cards as (
        delete from cards c using emptied
        where c.entry_id = emptied.entry_id and c.direction = emptied.direction
      )
      delete from accepted_answers a using emptied
      where a.entry_id = emptied.entry_id and a.direction = emptied.direction
    `;
    yield* sql`
      delete from accepted_answers
      where entry_id = any(${ids}::uuid[]) and source = 'textbook'
        and direction in ('to_synonym', 'to_antonym')
    `;
    const answers = relationAnswers(writes);
    if (answers.length > 0) {
      yield* sql`insert into accepted_answers ${sql.insert(answers)} on conflict do nothing`;
    }
    yield* sql`
      insert into cards (entry_id, direction)
      select e.id, d.direction
      from entries e
      cross join lateral (values
        ('to_synonym'::answer_direction, e.synonyms),
        ('to_antonym'::answer_direction, e.antonyms)
      ) as d(direction, words)
      where e.id = any(${ids}::uuid[]) and cardinality(d.words) > 0
      on conflict do nothing
    `;
  });

// Sets both lists of each word, a null list as null, along with the cards and
// answers that ask for them. Only words of the named course change; resolves
// to the ids written. The lists travel as one JSON parameter, as key points
// do. Runs inside the caller's transaction.
export const writeRelatedWords = (
  sql: Database,
  writes: ReadonlyArray<RelatedWordsWrite>,
) =>
  Effect.gen(function* () {
    const written = yield* sql<WrittenRow>`
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
    const writtenIds = new Set(written.map((row) => row.id));
    const applied = writes.filter((write) => writtenIds.has(write.entryId));
    if (applied.length > 0) {
      yield* syncRelationCards(sql, applied);
    }
    return written;
  });
