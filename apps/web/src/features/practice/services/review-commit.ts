import {
  isAcceptedAlternative,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';

export type ReviewCommitOperations<E> = {
  // Returns the card's new revision, or undefined when another submission got
  // there first and the expected revision no longer matches.
  readonly advanceCard: () => Effect.Effect<number | undefined, E>;
  readonly insertReview: () => Effect.Effect<void, E>;
  readonly insertAcceptedAlternative: () => Effect.Effect<void, E>;
};

export type RunReviewTransaction<E> = <A, E2>(
  work: (operations: ReviewCommitOperations<E>) => Effect.Effect<A, E2>,
) => Effect.Effect<A, E | E2>;

// Whether this answer rewrites the card's schedule. When it does not, the card
// row is left alone, so the revision the session has to answer against is the
// one it already holds.
export type ScheduleDecision =
  | { readonly advance: true }
  | { readonly advance: false; readonly revision: number };

export const commitGradedAnswer = <E>(
  runTransaction: RunReviewTransaction<E>,
  verdict: JudgeVerdictData | null,
  schedule: ScheduleDecision,
) =>
  runTransaction((operations) =>
    Effect.gen(function* () {
      const revision = schedule.advance
        ? yield* operations.advanceCard()
        : schedule.revision;
      if (revision === undefined) {
        return yield* new StaleAnswerSubmissionError({
          message: 'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
        });
      }
      if (verdict !== null && isAcceptedAlternative(verdict)) {
        yield* operations.insertAcceptedAlternative();
      }
      yield* operations.insertReview();
      return revision;
    }),
  );
