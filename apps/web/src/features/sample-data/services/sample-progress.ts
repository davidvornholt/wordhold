import type { Database } from '@wordhold/db/client';
import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { Array as Arr, Effect } from 'effect';
import { isRelationDirection } from '../../../shared/directions';
import { ratings } from '../../../shared/grading/rating';
import { syncRelationIntroduction } from '../../../shared/practice/relation-introduction';
import { type ReplayedCard, replayProgress } from './answer-history';
import type { WrittenEntry } from './sample-entries';

type CardRow = {
  readonly id: string;
  readonly entryId: string;
  readonly direction: AnswerDirection;
};

const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

// Words answered in one sitting were answered minutes apart: each word some
// minutes after the one before, within the sitting, and a word's later
// directions a few minutes after its earlier ones.
const sittingMinutes = 45;
const wordSpacingMinutes = 11;
const directionSpacingMinutes = 3;

const offsetMinutes = (index: number, direction: AnswerDirection) =>
  ((index * wordSpacingMinutes) % sittingMinutes) +
  directionSpacingMinutes *
    (answerDirections.length - 1 - answerDirections.indexOf(direction));

const scheduleRow = (card: CardRow, replayed: ReplayedCard) => ({
  id: card.id,
  // Synonym and antonym cards are introduced with their word, which
  // syncRelationIntroduction copies over once the translation cards are
  // written.
  introducedAt: isRelationDirection(card.direction)
    ? null
    : replayed.introducedAt,
  ...replayed.schedule,
});

const reviewRows = (
  card: CardRow,
  replayed: ReplayedCard,
  entry: WrittenEntry,
) => {
  const correct = entry.correct(card.direction);
  return replayed.answers.map((item) => {
    const forgotten = item.rating === ratings.again;
    return {
      cardId: card.id,
      reviewedAt: item.reviewedAt,
      rating: item.rating,
      mode: 'scheduled',
      answerText: forgotten ? '' : correct.answer,
      grading: JSON.stringify(forgotten ? { method: 'skip' } : correct.outcome),
      elapsedMs: item.elapsedMs,
    };
  });
};

const replayCards = (
  entries: ReadonlyArray<WrittenEntry>,
  cards: ReadonlyArray<CardRow>,
  now: Date,
) => {
  const byId = new Map(
    entries.map((entry, index) => [entry.id, { entry, index }]),
  );
  return cards.flatMap((card) => {
    const written = byId.get(card.entryId);
    if (written === undefined) {
      return [];
    }
    const replayed = replayProgress(written.entry.progress, {
      now,
      offsetMinutes: offsetMinutes(written.index, card.direction),
      ratesEasy: written.entry.ratesEasy,
    });
    return [
      {
        schedule: scheduleRow(card, replayed),
        reviews: reviewRows(card, replayed, written.entry),
      },
    ];
  });
};

// Replays each card's history, writes where it leaves the card, and logs
// every answer. Returns how many answers it logged.
export const writeSampleProgress = (
  sql: Database,
  entries: ReadonlyArray<WrittenEntry>,
  now: Date,
) =>
  Effect.gen(function* () {
    const ids = entries.map((entry) => entry.id);
    const cards = yield* sql<CardRow>`
      select id, entry_id as "entryId", direction from cards
      where entry_id = any(${uuidArray(ids)}::uuid[])
    `;
    const replayed = replayCards(entries, cards, now);
    const schedules = replayed.map((card) => card.schedule);
    const reviews = replayed.flatMap((card) => card.reviews);
    yield* sql`
      update cards c set
        introduced_at = v."introducedAt",
        state = v.state,
        due_at = v."dueAt",
        stability = v.stability,
        difficulty = v.difficulty,
        reps = v.reps,
        lapses = v.lapses,
        scheduled_days = v."scheduledDays",
        learning_steps = v."learningSteps",
        last_reviewed_at = v."lastReviewedAt"
      from jsonb_to_recordset(${JSON.stringify(schedules)}::jsonb) as v(
        id uuid, "introducedAt" timestamptz, state card_state,
        "dueAt" timestamptz, stability real, difficulty real, reps integer,
        lapses integer, "scheduledDays" real, "learningSteps" integer,
        "lastReviewedAt" timestamptz
      )
      where c.id = v.id
    `;
    if (Arr.isArrayNonEmpty(reviews)) {
      yield* sql`insert into reviews ${sql.insert(reviews)}`;
    }
    yield* syncRelationIntroduction(sql, ids);
    return reviews.length;
  });
