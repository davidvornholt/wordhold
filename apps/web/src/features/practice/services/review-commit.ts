import {
  isAcceptedAlternative,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';

export type ReviewCommitOperations<E> = {
  // Every graded answer claims the expected revision and writes the card's
  // schedule, which a held answer leaves as loaded. Undefined means the card
  // is stale: another submission or a correction of its entry came first.
  readonly advanceCard: () => Effect.Effect<number | undefined, E>;
  readonly insertReview: () => Effect.Effect<void, E>;
  readonly insertAcceptedAlternative: () => Effect.Effect<boolean, E>;
  // Whether the answered card's entry counts as "sicher" once this answer is
  // applied.
  readonly entryKnown: () => Effect.Effect<boolean, E>;
};

export type RunReviewTransaction<E> = <A, E2>(
  work: (operations: ReviewCommitOperations<E>) => Effect.Effect<A, E2>,
) => Effect.Effect<A, E | E2>;

export const commitGradedAnswer = <E>(
  runTransaction: RunReviewTransaction<E>,
  verdict: JudgeVerdictData | null,
) =>
  runTransaction((operations) =>
    Effect.gen(function* () {
      const revision = yield* operations.advanceCard();
      if (revision === undefined) {
        return yield* new StaleAnswerSubmissionError({
          message: 'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
        });
      }
      const alternativeStored =
        verdict !== null && isAcceptedAlternative(verdict)
          ? yield* operations.insertAcceptedAlternative()
          : false;
      yield* operations.insertReview();
      const entryKnown = yield* operations.entryKnown();
      return { revision, entryKnown, alternativeStored };
    }),
  );
