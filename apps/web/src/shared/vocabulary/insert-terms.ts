import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../grading/normalize';
import { findDuplicate } from './entry-identity';

export type NewTerm = {
  readonly courseId: string;
  // The photographed page the term was read from; null for a typed term.
  readonly pageId: string | null;
  readonly term: string;
  readonly definition: string;
};

// Every entry needs a book, so a subject keeps its terms in the one book it
// is created with (see createSubject). The learner never sees that book. A
// term is asked only from term to definition, so it gets that one card and
// the definition as its one accepted answer. Runs inside the caller's
// transaction and resolves undefined when the subject has no book. A page's
// terms share one transaction, so each takes the clock time of its own
// insert rather than the transaction's start; the subject then lists them
// in the order the page gave them.
export const insertTerm = (sql: Database, input: NewTerm) =>
  Effect.gen(function* () {
    const [entry] = yield* sql<{ readonly id: string }>`
      insert into entries
        (course_id, book_id, unit_id, page_id, target_text, native_text,
          created_at)
      select ${input.courseId}, b.id, null, ${input.pageId}, ${input.term},
        ${input.definition}, clock_timestamp()
      from books b
      where b.course_id = ${input.courseId}
      order by b.position asc
      limit 1
      returning id
    `;
    if (entry === undefined) {
      return;
    }
    yield* sql`
      insert into accepted_answers
        (entry_id, direction, text, normalized, source)
      values (${entry.id}, 'to_native', ${input.definition},
        ${normalizeAnswer(input.definition)}, 'textbook')
    `;
    yield* sql`
      insert into cards (entry_id, direction)
      values (${entry.id}, 'to_native')
    `;
    return entry.id;
  });

// Every term a subject has, in the order it was entered, apart from one
// being corrected.
export const selectTerms = (
  sql: Database,
  courseId: string,
  correctedEntryId: string | null,
) =>
  sql<{ readonly targetText: string }>`
    select target_text as "targetText" from entries
    where course_id = ${courseId}
      and (${correctedEntryId}::uuid is null or id <> ${correctedEntryId}::uuid)
    order by created_at, id
  `.pipe(Effect.map((rows) => rows.map((row) => row.targetText)));

// An exact repeat of a term is refused; the same term in another casing is
// the learner's deliberate choice.
export const isTermRepeat = (
  term: string,
  terms: ReadonlyArray<string>,
): boolean =>
  findDuplicate(
    { targetText: term, example: '' },
    terms.map((targetText) => ({ targetText, examples: [] })),
  ).verdict === 'exact';

// A corrected term is not compared with itself. Callers hold the per-course
// lock, so the answer stays true until they insert.
export const repeatsTerm = (
  sql: Database,
  courseId: string,
  term: string,
  correctedEntryId: string | null,
) =>
  selectTerms(sql, courseId, correctedEntryId).pipe(
    Effect.map((terms) => isTermRepeat(term, terms)),
  );
