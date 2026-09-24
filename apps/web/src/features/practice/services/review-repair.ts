import type { JudgeInput } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Data, Effect } from 'effect';
import {
  deriveRating,
  type GradeOutcome,
  ratings,
} from '../../../shared/grading/rating';
import { englishNames } from '../../../shared/languages';
import {
  type AcceptedAnswer,
  isDeterministicMatch,
} from './deterministic-grading';
import { judgeCacheIdentity } from './judge-cache';
import { PracticeJudge } from './practice-judge';
import {
  needsReassessment,
  type RepairCard,
  type RepairReview,
  type ReviewCorrection,
  replayCorrectedReviews,
} from './review-repair-plan';

export class ReviewRepairError extends Data.TaggedError('ReviewRepairError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type EntryCard = RepairCard & {
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
};

// A read-only plan contains its original rows. Apply compares those rows under
// locks before changing anything, so an intervening answer or content edit
// cannot silently be overwritten by this maintenance operation.
export type ReviewRepairPlan = {
  readonly card: EntryCard;
  readonly reviews: ReadonlyArray<RepairReview>;
  readonly accepted: ReadonlyArray<AcceptedAnswer>;
  readonly corrections: ReadonlyArray<ReviewCorrection>;
  readonly next: RepairCard;
  readonly policy: string;
};

const loadCards = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* sql<EntryCard>`
    select c.id, c.entry_id as "entryId", c.direction, c.introduced_at as "introducedAt",
      c.state, c.due_at as "dueAt", c.stability, c.difficulty, c.reps, c.lapses,
      c.scheduled_days as "scheduledDays", c.learning_steps as "learningSteps",
      c.last_reviewed_at as "lastReviewedAt", c.revision,
      e.target_text as "targetText", e.native_text as "nativeText",
      co.target_language as "targetLanguage"
    from cards c join entries e on e.id = c.entry_id join courses co on co.id = e.course_id
    where c.id = any(${`{${ids.join(',')}}`}::uuid[]) order by c.id
  `;
  });

const loadHistory = (card: EntryCard) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const reviews = yield* sql<RepairReview>`
    select id, reviewed_at as "reviewedAt", rating, answer_text as "answerText",
      elapsed_ms as "elapsedMs", grading from reviews where card_id = ${card.id}
    order by reviewed_at, id
  `;
    const accepted = yield* sql<AcceptedAnswer>`
    select text, source from accepted_answers
    where entry_id = ${card.entryId} and direction = ${card.direction}
    order by id
  `;
    return { reviews, accepted };
  });

const reassess = (input: JudgeInput, accepted: ReadonlyArray<AcceptedAnswer>) =>
  Effect.gen(function* () {
    if (isDeterministicMatch(input.givenAnswer, accepted)) {
      return { method: 'exact' } as const;
    }
    const judge = yield* PracticeJudge;
    return {
      method: 'judge',
      verdict: (yield* judge.judge(input)).verdict,
    } as const;
  });

const planCardRepair = (card: EntryCard) =>
  Effect.gen(function* () {
    const judge = yield* PracticeJudge;
    const { reviews, accepted } = yield* loadHistory(card);
    const baseline = replayCorrectedReviews(card, reviews, []);
    const scheduleFields = [
      'state',
      'reps',
      'lapses',
      'scheduledDays',
      'learningSteps',
    ] as const;
    if (scheduleFields.some((field) => baseline[field] !== card[field])) {
      return yield* new ReviewRepairError({
        message: `Unvollständiger oder abweichender Verlauf für ${card.id}; keine automatische Reparatur.`,
      });
    }
    const corrections: Array<ReviewCorrection> = [];
    const input = {
      direction: card.direction,
      targetLanguage: englishNames[card.targetLanguage],
      prompt:
        card.direction === 'to_target' ? card.nativeText : card.targetText,
      expectedAnswers: accepted.map((answer) => answer.text),
      givenAnswer: '',
    };
    // Identical old answers share this temporary cache. Planning does not write
    // judge_cache or teach accepted_answers before an operator applies the plan.
    const assessments = new Map<string, GradeOutcome>();
    for (const review of reviews.filter(needsReassessment)) {
      let outcome = assessments.get(review.answerText);
      if (outcome === undefined) {
        outcome = yield* reassess(
          { ...input, givenAnswer: review.answerText },
          accepted,
        );
        assessments.set(review.answerText, outcome);
      }
      const rating = deriveRating(outcome, review.elapsedMs);
      // This repair can restore demonstrated knowledge, never downgrade it.
      // Partial/contradictory approvals remain untouched for human inspection.
      if (rating >= ratings.good && rating > review.rating) {
        corrections.push({ review, rating, outcome });
      }
    }
    if (corrections.length > 0) {
      return {
        card,
        reviews,
        accepted,
        corrections,
        next: replayCorrectedReviews(card, reviews, corrections),
        policy: yield* Effect.promise(() =>
          judgeCacheIdentity(judge.model, input),
        ),
      };
    }
  });

export const planReviewRepairs = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const cards = yield* loadCards(ids);
    if (cards.length !== new Set(ids).size) {
      return yield* new ReviewRepairError({
        message: 'Eine angegebene Karte fehlt. Keine Änderungen vorgenommen.',
      });
    }
    const plans: Array<ReviewRepairPlan> = [];
    for (const card of cards) {
      const plan = yield* planCardRepair(card);
      if (plan !== undefined) {
        plans.push(plan);
      }
    }
    return plans;
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof ReviewRepairError
        ? cause
        : new ReviewRepairError({
            message:
              'Neubewertung fehlgeschlagen. Keine Änderungen vorgenommen.',
            cause,
          }),
    ),
  );

export const applyReviewRepairs = (plans: ReadonlyArray<ReviewRepairPlan>) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const plan of plans) {
          yield* sql`select id from cards where id = ${plan.card.id} for update`;
          yield* sql`select id from entries where id = ${plan.card.entryId} for update`;
          const current = (yield* loadCards([plan.card.id])).at(0);
          const history = yield* loadHistory(plan.card);
          if (
            JSON.stringify(current) !== JSON.stringify(plan.card) ||
            JSON.stringify(history) !==
              JSON.stringify({ reviews: plan.reviews, accepted: plan.accepted })
          ) {
            return yield* new ReviewRepairError({
              message:
                'Karte oder Verlauf inzwischen geändert. Plan erneut erstellen.',
            });
          }
          for (const correction of plan.corrections) {
            const grading = {
              ...correction.outcome,
              repair: {
                policy: plan.policy,
                repairedAt: new Date().toISOString(),
                originalRating: correction.review.rating,
                originalGrading: correction.review.grading,
              },
            };
            yield* sql`update reviews set rating = ${correction.rating}, grading = ${JSON.stringify(grading)}::jsonb
          where id = ${correction.review.id}`;
          }
          const { next } = plan;
          yield* sql`update cards set state = ${next.state}::card_state, due_at = ${next.dueAt},
        stability = ${next.stability}, difficulty = ${next.difficulty}, reps = ${next.reps},
        lapses = ${next.lapses}, scheduled_days = ${next.scheduledDays}, learning_steps = ${next.learningSteps},
        last_reviewed_at = ${next.lastReviewedAt}, revision = revision + 1 where id = ${next.id}`;
          yield* sql`delete from judge_cache where entry_id = ${plan.card.entryId} and direction = ${plan.card.direction}`;
        }
      }),
    );
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof ReviewRepairError
        ? cause
        : new ReviewRepairError({
            message: 'Reparatur fehlgeschlagen; Transaktion zurückgerollt.',
            cause,
          }),
    ),
  );
