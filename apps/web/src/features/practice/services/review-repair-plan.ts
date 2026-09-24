import type { cards } from '@wordhold/db/schema/practice';
import type {
  DerivedRating,
  GradeOutcome,
} from '../../../shared/grading/rating';
import { applyRating } from './fsrs';
import { advancesSchedule } from './schedule-guard';

export type RepairCard = typeof cards.$inferSelect;
export type RepairReview = {
  readonly id: string;
  readonly reviewedAt: Date;
  readonly rating: DerivedRating;
  readonly answerText: string;
  readonly elapsedMs: number | null;
  readonly grading: unknown;
};
export type ReviewCorrection = {
  readonly review: RepairReview;
  readonly rating: DerivedRating;
  readonly outcome: GradeOutcome;
};

// Replaying respects the same early-review guard as live practice: correcting
// a six-minute loop must not turn every unnecessary repeat into extra growth.
export const replayCorrectedReviews = (
  stored: RepairCard,
  reviews: ReadonlyArray<RepairReview>,
  corrections: ReadonlyArray<ReviewCorrection>,
): RepairCard => {
  let card: RepairCard = {
    ...stored,
    state: 'new',
    dueAt: null,
    stability: null,
    difficulty: null,
    reps: 0,
    lapses: 0,
    scheduledDays: 0,
    learningSteps: 0,
    lastReviewedAt: null,
  };
  const correctedRatings = new Map(
    corrections.map((item) => [item.review.id, item.rating]),
  );
  for (const review of reviews) {
    const rating = correctedRatings.get(review.id) ?? review.rating;
    if (advancesSchedule(card, review.reviewedAt, rating !== 1)) {
      card = { ...card, ...applyRating(card, rating, review.reviewedAt) };
    }
  }
  return card;
};

export const needsReassessment = (review: RepairReview): boolean => {
  if (
    review.rating > 2 ||
    review.grading === null ||
    typeof review.grading !== 'object'
  ) {
    return false;
  }
  return (
    'method' in review.grading &&
    (review.grading.method === 'judge' ||
      review.grading.method === 'learner-correction')
  );
};
