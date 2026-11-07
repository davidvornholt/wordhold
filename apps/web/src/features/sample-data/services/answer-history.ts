import { type DerivedRating, ratings } from '../../../shared/grading/rating';
import { applyRating, type CardSchedule } from '../../../shared/practice/fsrs';
import {
  type HistoryAnswer,
  histories,
  type Progress,
} from '../content/sample-histories';

export type ReplayedAnswer = {
  readonly reviewedAt: Date;
  readonly rating: DerivedRating;
  readonly elapsedMs: number;
  // Where the card stood when it was answered.
  readonly before: Pick<CardSchedule, 'state' | 'dueAt'>;
};

export type ReplayedCard = {
  readonly introducedAt: Date | null;
  readonly schedule: CardSchedule;
  readonly answers: ReadonlyArray<ReplayedAnswer>;
};

const minute = 60_000;
const day = 24 * 60 * minute;
// A word met in the learning pass without an answer yet was met this long ago.
const metMinutesAgo = 15;
// The learning pass shows a word this long before its first answer.
const metBeforeAnswerMinutes = 2;

// Answer times that match the rating practice derives from them: an exact
// answer to a card in review is easy only when it took under five seconds.
// Each time varies by up to six steps, so answers do not all take as long.
const easyAnswerMs = 2800;
const goodAnswerMs = 6500;
const forgottenAnswerMs = 12_000;
const answerTimeSteps = 7;
const answerTimeStepMs = 300;

const unscheduled: CardSchedule = {
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

const baseAnswerMs = (rating: DerivedRating) => {
  if (rating === ratings.easy) {
    return easyAnswerMs;
  }
  return rating === ratings.again ? forgottenAnswerMs : goodAnswerMs;
};

const elapsedMs = (rating: DerivedRating, variation: number): number =>
  baseAnswerMs(rating) + (variation % answerTimeSteps) * answerTimeStepMs;

const ratingOf = (
  rating: HistoryAnswer['rating'],
  ratesEasy: boolean,
): DerivedRating => {
  if (rating === 'again') {
    return ratings.again;
  }
  return rating === 'easy' && ratesEasy ? ratings.easy : ratings.good;
};

export type ReplayInput = {
  readonly now: Date;
  // Moves the whole history earlier, so words with the same progress were
  // not all answered in the same second.
  readonly offsetMinutes: number;
  // A definition or recited text is never rated easy, so its easy answers
  // count as good.
  readonly ratesEasy: boolean;
};

// Replays a progress kind's history through the real scheduler, ending at
// `now`.
export const replayProgress = (
  progress: Progress,
  input: ReplayInput,
): ReplayedCard => {
  const shift = input.offsetMinutes * minute;
  if (progress === 'unmet') {
    return { introducedAt: null, schedule: unscheduled, answers: [] };
  }
  if (progress === 'met') {
    return {
      introducedAt: new Date(
        input.now.getTime() - shift - metMinutesAgo * minute,
      ),
      schedule: unscheduled,
      answers: [],
    };
  }
  let schedule = unscheduled;
  const answers: Array<ReplayedAnswer> = [];
  for (const step of histories[progress]) {
    const reviewedAt = new Date(
      input.now.getTime() - shift - step.daysAgo * day,
    );
    const rating = ratingOf(step.rating, input.ratesEasy);
    answers.push({
      reviewedAt,
      rating,
      elapsedMs: elapsedMs(rating, input.offsetMinutes + answers.length),
      before: { state: schedule.state, dueAt: schedule.dueAt },
    });
    schedule = applyRating(schedule, rating, reviewedAt);
  }
  const first = answers[0]?.reviewedAt ?? input.now;
  return {
    introducedAt: new Date(first.getTime() - metBeforeAnswerMinutes * minute),
    schedule,
    answers,
  };
};
