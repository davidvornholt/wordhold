import type { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';

type TextbookAnswer = {
  readonly direction: AnswerDirection;
  readonly text: string;
};

// Corrected texts replace the entry's textbook answers. The alternatives the
// AI judge accepted were judged against the old texts, so they go too, and
// the next answers are judged against the new ones. Runs inside the caller's
// transaction.
export const replaceTextbookAnswers = (
  sql: Database,
  entryId: string,
  answers: ReadonlyArray<TextbookAnswer>,
) =>
  Effect.gen(function* () {
    yield* sql`
      delete from accepted_answers
      where entry_id = ${entryId} and source in ('textbook', 'judge')
    `;
    yield* sql`insert into accepted_answers ${sql.insert(
      answers.map((answer) => ({
        entryId,
        direction: answer.direction,
        text: answer.text,
        normalized: normalizeAnswer(answer.text),
        source: 'textbook',
      })),
    )} on conflict do nothing`;
  });
