import { isAcceptedAlternative } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import {
  advancesSchedule,
  applyRating,
  type ReplayedReview,
  replayReviews,
} from '@wordhold/db/fsrs';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { AnswerSource } from '@wordhold/db/schema/entries';
import type { cards } from '@wordhold/db/schema/practice';
import { Context, Effect, Layer } from 'effect';
import type { AcceptedAnswer } from '../../../shared/grading/deterministic-match';
import { ratings } from '../../../shared/grading/rating';
import { entryIsKnown } from '../../../shared/practice/known-entry';
import { cardRelatedWords } from '../../../shared/practice/practised-directions';
import { saveDerivedKeyPoints } from '../../../shared/vocabulary/key-points';
import {
  PracticeDatabaseError,
  type StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  CourseEntryPlace,
  PersistedReview,
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import { commitGradedAnswer, type RunReviewTransaction } from './review-commit';

type SubmissionRow = typeof cards.$inferSelect & {
  readonly targetText: string;
  readonly nativeText: string;
  readonly keyPoints: ReadonlyArray<string> | null;
  readonly relatedWords: ReadonlyArray<string>;
  readonly courseKind: CourseKind;
  readonly targetLanguage: LanguageCode;
  readonly examInCourse: boolean;
};

const databaseError = (operation: string, cause: unknown) =>
  new PracticeDatabaseError({
    operation,
    cause,
    message: 'Die Antwort konnte nicht gespeichert werden.',
  });

// The previous app version keeps answering during a deploy and after a roll
// back, so a card can still have FSRS-6 memory after the migration rebuilt
// every such card. It is rebuilt from its answers the way the migration does,
// and the commit stores the result under the card's revision guard.
const withFsrs7Memory = (
  sql: Database,
  row: SubmissionRow,
  timeZone: string,
) =>
  row.stability === null || row.stabilityFast !== null
    ? Effect.succeed(row)
    : sql<ReplayedReview>`
        select reviewed_at as "reviewedAt", rating from reviews
        where card_id = ${row.id}
        order by reviewed_at, id
      `.pipe(
        Effect.map((history) => ({
          ...row,
          ...replayReviews(history, timeZone),
        })),
      );

const loadEntryKnown = (sql: Database, entryId: string) =>
  sql<{ readonly known: boolean }>`
    select ${entryIsKnown(sql)} as known
    from entries e
    join courses co on co.id = e.course_id
    where e.id = ${entryId}
  `.pipe(
    Effect.map((rows) => rows.at(0)?.known ?? false),
    Effect.mapError((cause) => databaseError('commit graded answer', cause)),
  );

// Lock entries before cards, matching edits that also remove judge
// alternatives, and hold matching texts until insertion.
const lockGradedEntry = (sql: Database, input: PersistReviewInput) =>
  input.outcome.method === 'judge' &&
  isAcceptedAlternative(input.outcome.verdict)
    ? sql`
        select 1 from entries
        where id = ${input.entryId}
          and target_text = ${input.gradedTexts.targetText}
          and native_text = ${input.gradedTexts.nativeText}
        for share
      `.pipe(Effect.map((rows) => rows.length > 0))
    : Effect.succeed(false);

const insertJudgeAlternative = (
  sql: Database,
  input: PersistReviewInput,
  unchanged: boolean,
) =>
  unchanged
    ? sql`
        insert into accepted_answers
          (entry_id, direction, text, normalized, source)
        values (${input.entryId}, ${input.direction}, ${input.answer.trim()},
          ${input.normalizedAnswer}, 'judge')
        on conflict do nothing
        returning id
      `.pipe(
        Effect.map((rows) => rows.length > 0),
        Effect.mapError((cause) =>
          databaseError('commit graded answer', cause),
        ),
      )
    : Effect.succeed(false);

// The answer counts for its test round only while no newer round of the
// same test has given that round up. A late answer to a given-up round is
// stored as ordinary practice. The review logs the time the schedule was
// computed for, which repair replays exactly.
const insertReview = (sql: Database, input: PersistReviewInput) =>
  sql`
    insert into reviews
      (card_id, reviewed_at, rating, answer_text, grading, elapsed_ms, mode,
        exam_round_id)
    values (${input.card.id}, ${input.reviewedAt}, ${input.rating}, ${input.answer},
      ${JSON.stringify(input.outcome)}::jsonb, ${input.elapsedMs},
      ${input.mode}::review_mode,
      (select rc.round_id from exam_round_cards rc
        join exam_rounds r on r.id = rc.round_id
        where rc.round_id = ${input.examRoundId}::uuid
          and rc.card_id = ${input.card.id}
          and not exists (
            select from exam_rounds newer
            where newer.exam_id = r.exam_id
              and (newer.started_at, newer.id) > (r.started_at, r.id))))
  `.pipe(
    Effect.asVoid,
    Effect.mapError((cause) => databaseError('commit graded answer', cause)),
  );

const listCourseEntries = (sql: Database, entryId: string) =>
  sql<CourseEntryPlace>`
    select e.target_text as text, coalesce(u.name, b.name) as place
    from entries asked
    join entries e on e.course_id = asked.course_id and e.id <> asked.id
    join books b on b.id = e.book_id
    left join units u on u.id = e.unit_id
    where asked.id = ${entryId}
    order by b.position, u.position nulls last, e.created_at, e.id
  `.pipe(
    Effect.mapError((cause) => databaseError('list course entries', cause)),
  );

// `examInCourse` holds whether `examId` names a test of the card's course.
const findSubmission =
  (sql: Database, timeZone: string) =>
  (cardId: string, revision: number, examId: string | null) =>
    sql<SubmissionRow>`
      select c.id, c.entry_id as "entryId", c.direction,
        c.state, c.due_at as "dueAt", c.stability,
        c.stability_fast as "stabilityFast", c.difficulty,
        c.reps, c.lapses, c.scheduled_days as "scheduledDays",
        c.learning_steps as "learningSteps",
        c.last_reviewed_at as "lastReviewedAt", c.revision,
        e.target_text as "targetText",
        e.native_text as "nativeText", e.key_points as "keyPoints",
        ${cardRelatedWords(sql)} as "relatedWords",
        co.kind as "courseKind", co.target_language as "targetLanguage",
        exists (select from exams x
          where x.id = ${examId}::uuid and x.course_id = co.id)
          as "examInCourse"
      from cards c
      join entries e on e.id = c.entry_id
      join courses co on co.id = e.course_id
      where c.id = ${cardId} and c.revision = ${revision}
        and c.introduced_at is not null
    `.pipe(
      Effect.flatMap(([stored]) =>
        stored === undefined
          ? Effect.succeed(undefined)
          : withFsrs7Memory(sql, stored, timeZone),
      ),
      Effect.map((row) =>
        row === undefined
          ? undefined
          : {
              card: row,
              entry: {
                id: row.entryId,
                targetText: row.targetText,
                nativeText: row.nativeText,
                keyPoints: row.keyPoints,
                relatedWords: row.relatedWords,
              },
              courseKind: row.courseKind,
              targetLanguage: row.targetLanguage,
              examInCourse: row.examInCourse,
            },
      ),
      Effect.mapError((cause) => databaseError('find submitted card', cause)),
    );

export class PracticeReviewStore extends Context.Service<
  PracticeReviewStore,
  {
    // `examId` is the test the submission names, if any.
    readonly findSubmission: (
      cardId: string,
      revision: number,
      examId: string | null,
    ) => Effect.Effect<SubmissionRecord | undefined, PracticeDatabaseError>;
    readonly listAcceptedAnswers: (
      entryId: string,
      direction: AnswerDirection,
    ) => Effect.Effect<ReadonlyArray<AcceptedAnswer>, PracticeDatabaseError>;
    // The other entries of the entry's course, in the order the books teach
    // them.
    readonly listCourseEntries: (
      entryId: string,
    ) => Effect.Effect<ReadonlyArray<CourseEntryPlace>, PracticeDatabaseError>;
    // Stores key points derived during grading; see saveDerivedKeyPoints.
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
>()('wordhold/PracticeReviewStore') {
  // `timeZone` is the owner's IANA zone, which due dates start their days in.
  static readonly live = (timeZone: string) =>
    Layer.effect(
      PracticeReviewStore,
      Effect.gen(function* () {
        const sql = yield* Database;
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
        const saveKeyPoints = (
          entryId: string,
          definition: string,
          keyPoints: ReadonlyArray<string>,
        ) =>
          saveDerivedKeyPoints(sql, entryId, definition, keyPoints).pipe(
            Effect.mapError((cause) => databaseError('save key points', cause)),
          );
        const commit = (input: PersistReviewInput) => {
          const scheduleAdvances = advancesSchedule(
            input.card,
            input.reviewedAt,
            input.rating !== ratings.again,
          );
          // A held answer writes back the schedule the card was loaded with,
          // which stores the memory findSubmission rebuilt from FSRS-6.
          const next = scheduleAdvances
            ? applyRating(input.card, input.rating, input.reviewedAt, timeZone)
            : input.card;
          const mapCommitError = (cause: unknown) =>
            databaseError('commit graded answer', cause);
          const runTransaction: RunReviewTransaction<PracticeDatabaseError> = (
            work,
          ) =>
            sql
              .withTransaction(
                Effect.gen(function* () {
                  const unchanged = yield* lockGradedEntry(sql, input);
                  return yield* work({
                    advanceCard: () =>
                      sql<{ readonly revision: number }>`
                        update cards set state = ${next.state}::card_state,
                          due_at = ${next.dueAt}, stability = ${next.stability},
                          stability_fast = ${next.stabilityFast},
                          difficulty = ${next.difficulty}, reps = ${next.reps},
                          lapses = ${next.lapses}, scheduled_days = ${next.scheduledDays},
                          learning_steps = ${next.learningSteps},
                          last_reviewed_at = ${next.lastReviewedAt},
                          revision = revision + 1
                        where id = ${input.card.id} and revision = ${input.expectedRevision}
                          and introduced_at is not null
                        returning revision
                      `.pipe(
                        Effect.map((rows) => rows.at(0)?.revision),
                        Effect.mapError(mapCommitError),
                      ),
                    insertAcceptedAlternative: () =>
                      insertJudgeAlternative(sql, input, unchanged),
                    insertReview: () => insertReview(sql, input),
                    entryKnown: () => loadEntryKnown(sql, input.entryId),
                  });
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
          ).pipe(
            Effect.map((committed) => ({
              ...committed,
              schedule: {
                advanced: scheduleAdvances,
                state: next.state,
                dueAt: next.dueAt,
              },
            })),
          );
        };
        return {
          findSubmission: findSubmission(sql, timeZone),
          listAcceptedAnswers,
          listCourseEntries: (entryId: string) =>
            listCourseEntries(sql, entryId),
          saveKeyPoints,
          commit,
        } as const;
      }),
    );
}
