import { Database } from '@wordhold/db/client';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { AnswerSource } from '@wordhold/db/schema/entries';
import type { cards, ReviewMode } from '@wordhold/db/schema/practice';
import { Context, Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  PracticeDatabaseError,
  type StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  PersistedReview,
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { AcceptedAnswer } from './deterministic-grading';
import { applyRating } from './fsrs';
import { commitGradedAnswer, type RunReviewTransaction } from './review-commit';
import { advancesSchedule } from './schedule-guard';

type SubmissionRow = typeof cards.$inferSelect & {
  readonly targetText: string;
  readonly nativeText: string;
  readonly keyPoints: ReadonlyArray<string> | null;
  readonly courseKind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

const databaseError = (operation: string, cause: unknown) =>
  new PracticeDatabaseError({
    operation,
    cause,
    message: 'Die Antwort konnte nicht gespeichert werden.',
  });

// The read is a separate statement: an update that waited for another
// request's write skips the row, and only a later statement sees what
// that request stored.
const saveKeyPointsWith =
  (sql: Database) =>
  (entryId: string, definition: string, keyPoints: ReadonlyArray<string>) =>
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
    }).pipe(
      Effect.mapError((cause) => databaseError('save key points', cause)),
    );

export class PracticeReviewStore extends Context.Tag(
  'wordhold/PracticeReviewStore',
)<
  PracticeReviewStore,
  {
    readonly findSubmission: (
      cardId: string,
      revision: number,
      mode: ReviewMode,
    ) => Effect.Effect<SubmissionRecord | undefined, PracticeDatabaseError>;
    readonly listAcceptedAnswers: (
      entryId: string,
      direction: AnswerDirection,
    ) => Effect.Effect<ReadonlyArray<AcceptedAnswer>, PracticeDatabaseError>;
    // Stores key points derived during grading, unless the definition changed
    // or key points were set in the meantime. Returns the key points the
    // entry now has, or null when the definition changed.
    readonly saveKeyPoints: (
      entryId: string,
      definition: string,
      keyPoints: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<string> | null, PracticeDatabaseError>;
    readonly commit: (
      input: PersistReviewInput,
    ) => Effect.Effect<
      PersistedReview,
      PracticeDatabaseError | StaleAnswerSubmissionError
    >;
  }
>() {
  static readonly live = Layer.effect(
    PracticeReviewStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const findSubmission = (
        cardId: string,
        revision: number,
        mode: ReviewMode,
      ) =>
        sql<SubmissionRow>`
          select c.id, c.entry_id as "entryId", c.direction,
            c.state, c.due_at as "dueAt", c.stability, c.difficulty,
            c.reps, c.lapses, c.scheduled_days as "scheduledDays",
            c.learning_steps as "learningSteps",
            c.last_reviewed_at as "lastReviewedAt", c.revision,
            e.target_text as "targetText",
            e.native_text as "nativeText", e.key_points as "keyPoints",
            co.kind as "courseKind", co.target_language as "targetLanguage"
          from cards c
          join entries e on e.id = c.entry_id
          join courses co on co.id = e.course_id
          where c.id = ${cardId} and c.revision = ${revision}
            and (
              c.introduced_at is not null
              or ${mode}::review_mode = 'drill'::review_mode
            )
        `.pipe(
          Effect.map((rows) => {
            const [row] = rows;
            return row === undefined
              ? undefined
              : {
                  card: row,
                  entry: {
                    id: row.entryId,
                    targetText: row.targetText,
                    nativeText: row.nativeText,
                    keyPoints: row.keyPoints,
                  },
                  courseKind: row.courseKind,
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
          readonly source: AnswerSource;
        }>`
          select text, source from accepted_answers
          where entry_id = ${entryId} and direction = ${direction}
        `.pipe(
          Effect.mapError((cause) =>
            databaseError('load accepted answers', cause),
          ),
        );
      const saveKeyPoints = saveKeyPointsWith(sql);
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
                advanceCard: (advanceSchedule) =>
                  (advanceSchedule
                    ? sql<{ readonly revision: number }>`
                        update cards set state = ${next.state}::card_state,
                          due_at = ${next.dueAt}, stability = ${next.stability},
                          difficulty = ${next.difficulty}, reps = ${next.reps},
                          lapses = ${next.lapses}, scheduled_days = ${next.scheduledDays},
                          learning_steps = ${next.learningSteps},
                          last_reviewed_at = ${next.lastReviewedAt},
                          revision = revision + 1,
                          introduced_at = coalesce(introduced_at, ${input.reviewedAt})
                        where id = ${input.card.id} and revision = ${input.expectedRevision}
                          and (
                            introduced_at is not null
                            or ${input.mode}::review_mode = 'drill'::review_mode
                          )
                        returning revision
                      `
                    : sql<{ readonly revision: number }>`
                        update cards set revision = revision + 1,
                          introduced_at = coalesce(introduced_at, ${input.reviewedAt})
                        where id = ${input.card.id} and revision = ${input.expectedRevision}
                          and (
                            introduced_at is not null
                            or ${input.mode}::review_mode = 'drill'::review_mode
                          )
                        returning revision
                      `
                  ).pipe(
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
                      (card_id, rating, answer_text, grading, elapsed_ms, mode)
                    values (${input.card.id}, ${input.rating}, ${input.answer},
                      ${JSON.stringify(input.outcome)}::jsonb, ${input.elapsedMs},
                      ${input.mode}::review_mode)
                  `.pipe(Effect.asVoid, Effect.mapError(mapCommitError)),
              }),
            )
            .pipe(
              Effect.catchTag('SqlError', (cause) =>
                Effect.fail(mapCommitError(cause)),
              ),
            );
        const scheduleAdvances = advancesSchedule(
          input.card,
          input.reviewedAt,
          input.rating !== ratings.again,
        );
        return commitGradedAnswer(
          runTransaction,
          input.outcome.method === 'judge' ? input.outcome.verdict : null,
          scheduleAdvances,
        ).pipe(
          Effect.map((revision) => ({
            revision,
            schedule: scheduleAdvances
              ? {
                  advanced: true,
                  state: next.state,
                  dueAt: next.dueAt,
                }
              : {
                  advanced: false,
                  state: input.card.state,
                  dueAt: input.card.dueAt,
                },
          })),
        );
      };
      return {
        findSubmission,
        listAcceptedAnswers,
        saveKeyPoints,
        commit,
      } as const;
    }),
  );
}
