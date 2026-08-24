import {
  isAcceptedAlternative,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';

export type ReviewCommitOperations<E> = {
  readonly advanceCard: () => Effect.Effect<boolean, E>;
  readonly insertReview: () => Effect.Effect<void, E>;
  readonly insertAcceptedAlternative: () => Effect.Effect<void, E>;
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
      if (!(yield* operations.advanceCard())) {
        return yield* new StaleAnswerSubmissionError({
          message: 'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
        });
      }
      if (verdict !== null && isAcceptedAlternative(verdict)) {
        yield* operations.insertAcceptedAlternative();
      }
      yield* operations.insertReview();
    }),
  );
