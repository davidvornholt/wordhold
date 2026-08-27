import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type {
  AnswerDirection,
  AnswerSource,
  EntryType,
} from '@wordhold/db/schema/entries';
import type { cards } from '@wordhold/db/schema/practice';
import { Context, Effect, Layer } from 'effect';
import {
  PracticeDatabaseError,
  type StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { AcceptedAnswer } from './deterministic-grading';
import { applyRating } from './fsrs';
import { commitGradedAnswer, type RunReviewTransaction } from './review-commit';

type SubmissionRow = typeof cards.$inferSelect & {
  readonly entryType: EntryType;
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
};

const databaseError = (operation: string, cause: unknown) =>
  new PracticeDatabaseError({
    operation,
    cause,
    message: 'Die Antwort konnte nicht gespeichert werden.',
  });

export class PracticeReviewStore extends Context.Tag(
  'wordhold/PracticeReviewStore',
)<
  PracticeReviewStore,
  {
    readonly findSubmission: (
      cardId: string,
      revision: number,
    ) => Effect.Effect<SubmissionRecord | undefined, PracticeDatabaseError>;
    readonly listAcceptedAnswers: (
      entryId: string,
      direction: AnswerDirection,
    ) => Effect.Effect<ReadonlyArray<AcceptedAnswer>, PracticeDatabaseError>;
    // Resolves with the card's revision after the review, which the practice
    // session needs to answer the same card again.
    readonly commit: (
      input: PersistReviewInput,
    ) => Effect.Effect<
      number,
      PracticeDatabaseError | StaleAnswerSubmissionError
    >;
  }
>() {
  static readonly live = Layer.effect(
    PracticeReviewStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const findSubmission = (cardId: string, revision: number) =>
        sql<SubmissionRow>`
          select c.id, c.entry_id as "entryId", c.direction,
            c.state, c.due_at as "dueAt", c.stability, c.difficulty,
            c.reps, c.lapses, c.scheduled_days as "scheduledDays",
            c.learning_steps as "learningSteps",
            c.last_reviewed_at as "lastReviewedAt", c.revision,
            e.type as "entryType", e.target_text as "targetText",
            e.native_text as "nativeText", co.target_language as "targetLanguage"
          from cards c
          join entries e on e.id = c.entry_id
          join courses co on co.id = e.course_id
          where c.id = ${cardId} and c.revision = ${revision}
            and c.introduced_at is not null
        `.pipe(
          Effect.map((rows) => {
            const [row] = rows;
            return row === undefined
              ? undefined
              : {
                  card: row,
                  entry: {
                    id: row.entryId,
                    type: row.entryType,
                    targetText: row.targetText,
                    nativeText: row.nativeText,
                  },
                  targetLanguage: row.targetLanguage,
                };
          }),
          Effect.mapError((cause) =>
            databaseError('find submitted card', cause),
          ),
        );
      const listAcceptedAnswers = (
        entryId: string,
        direction: AnswerDirection,
      ) =>
        sql<{
          readonly text: string;
          readonly normalized: string;
          readonly source: AnswerSource;
        }>`
          select text, normalized, source from accepted_answers
          where entry_id = ${entryId} and direction = ${direction}
        `.pipe(
          Effect.mapError((cause) =>
            databaseError('load accepted answers', cause),
          ),
        );
      const commit = (input: PersistReviewInput) => {
        const next = applyRating(input.card, input.rating, input.reviewedAt);
        const mapCommitError = (cause: unknown) =>
          databaseError('commit graded answer', cause);
        const runTransaction: RunReviewTransaction<PracticeDatabaseError> = (
          work,
        ) =>
          sql
            .withTransaction(
              work({
                advanceCard: () =>
                  sql<{ readonly revision: number }>`
                    update cards set state = ${next.state}::card_state,
                      due_at = ${next.dueAt}, stability = ${next.stability},
                      difficulty = ${next.difficulty}, reps = ${next.reps},
                      lapses = ${next.lapses}, scheduled_days = ${next.scheduledDays},
                      learning_steps = ${next.learningSteps},
                      last_reviewed_at = ${next.lastReviewedAt}, revision = revision + 1
                    where id = ${input.card.id} and revision = ${input.expectedRevision}
                      and introduced_at is not null
                    returning revision
                  `.pipe(
                    Effect.map((rows) => rows.at(0)?.revision),
                    Effect.mapError(mapCommitError),
                  ),
                insertAcceptedAlternative: () =>
                  sql`
                    insert into accepted_answers
                      (entry_id, direction, text, normalized, source)
                    values (${input.entryId}, ${input.direction}, ${input.answer.trim()},
                      ${input.normalizedAnswer}, 'judge')
                    on conflict do nothing
                  `.pipe(Effect.asVoid, Effect.mapError(mapCommitError)),
                insertReview: () =>
                  sql`
                    insert into reviews
                      (card_id, rating, answer_text, grading, elapsed_ms)
                    values (${input.card.id}, ${input.rating}, ${input.answer},
                      ${JSON.stringify(input.outcome)}::jsonb, ${input.elapsedMs})
                  `.pipe(Effect.asVoid, Effect.mapError(mapCommitError)),
              }),
            )
            .pipe(
              Effect.catchTag('SqlError', (cause) =>
                Effect.fail(mapCommitError(cause)),
              ),
            );
        return commitGradedAnswer(
          runTransaction,
          input.outcome.method === 'judge' ? input.outcome.verdict : null,
        );
      };
      return { findSubmission, listAcceptedAnswers, commit } as const;
    }),
  );
}
