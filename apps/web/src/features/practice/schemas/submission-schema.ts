import { reviewModes } from '@wordhold/db/schema/practice';
import { Schema } from 'effect';

const hoursPerDay = 24;
const minutesPerHour = 60;
const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const maximumIncrementablePostgresInteger = 2_147_483_646;

export const maximumElapsedMs =
  hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond;

const ElapsedMilliseconds = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(maximumElapsedMs),
);

const CardRevision = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(maximumIncrementablePostgresInteger),
);

export const SubmitPayload = Schema.Struct({
  cardId: Schema.UUID,
  revision: CardRevision,
  answer: Schema.String,
  elapsedMs: Schema.optional(ElapsedMilliseconds),
  // Which sitting the answer came from. It decides whether the answer may
  // rewrite the card's schedule, so the client states it rather than the
  // server guessing from the card.
  mode: Schema.Literal(...reviewModes),
});

export type SubmitPayloadData = typeof SubmitPayload.Type;

export const decodeSubmitPayload = Schema.decodeUnknownSync(SubmitPayload);
