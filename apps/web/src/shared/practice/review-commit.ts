import {
  isAcceptedAlternative,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';

export class StaleAnswerSubmissionError extends Error {
  readonly name = 'StaleAnswerSubmissionError';
}

export type ReviewCommitOperations = {
  readonly advanceCard: () => Promise<boolean>;
  readonly insertReview: () => Promise<void>;
  readonly insertAcceptedAlternative: () => Promise<void>;
};

export type RunReviewTransaction = (
  work: (operations: ReviewCommitOperations) => Promise<void>,
) => Promise<void>;

export const commitGradedAnswer = async (
  runTransaction: RunReviewTransaction,
  verdict: JudgeVerdictData | null,
): Promise<void> =>
  runTransaction(async (operations) => {
    if (!(await operations.advanceCard())) {
      throw new StaleAnswerSubmissionError(
        'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
      );
    }
    if (verdict !== null && isAcceptedAlternative(verdict)) {
      await operations.insertAcceptedAlternative();
    }
    await operations.insertReview();
  });
