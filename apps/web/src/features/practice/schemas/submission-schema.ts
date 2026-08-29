import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { reviewModes } from '@wordhold/db/schema/practice';
import { Schema } from 'effect';

const hoursPerDay = 24;
const minutesPerHour = 60;
const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const maximumIncrementablePostgresInteger = 2_147_483_646;

export const maximumElapsedMs =
  hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond;
export const maximumSubmittedAnswerLength = maximumEntryTextLength;

export const wrongAnswerResolutions = ['defer', 'again', 'hard'] as const;
export type WrongAnswerResolution = (typeof wrongAnswerResolutions)[number];

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

const SubmitPayloadBase = Schema.Struct({
  cardId: Schema.UUID,
  revision: CardRevision,
  answer: Schema.String.pipe(Schema.maxLength(maximumSubmittedAnswerLength)),
  elapsedMs: Schema.optional(ElapsedMilliseconds),
  // Which sitting the answer came from. This is provenance for the review
  // log. Scheduling is derived from the server-owned card state.
  mode: Schema.Literal(...reviewModes),
});

export const SubmitPayload = Schema.Union(
  Schema.Struct({
    ...SubmitPayloadBase.fields,
    wrongAnswerResolution: Schema.Literal('defer'),
  }),
  Schema.Struct({
    ...SubmitPayloadBase.fields,
    // A resolution must point to the exact rejected server assessment shown
    // to the learner. Re-grading here could change what gets committed.
    wrongAnswerResolution: Schema.Literal('again', 'hard'),
    assessmentId: Schema.UUID,
  }),
);

export type SubmitPayloadData = typeof SubmitPayload.Type;

export const decodeSubmitPayload = Schema.decodeUnknownSync(SubmitPayload);
