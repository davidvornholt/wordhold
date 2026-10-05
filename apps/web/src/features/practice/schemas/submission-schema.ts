import { reviewModes } from '@wordhold/db/schema/practice';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { maximumMemorizedTextLength } from '../../../shared/vocabulary/entry-fields';

const hoursPerDay = 24;
const minutesPerHour = 60;
const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const maximumIncrementablePostgresInteger = 2_147_483_646;

export const maximumElapsedMs =
  hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond;
// The longest answer is a recited text. Answers the judge grades are held to
// the entry length once their course is known.
export const maximumSubmittedAnswerLength = maximumMemorizedTextLength;

export const wrongAnswerResolutions = ['defer', 'again', 'hard'] as const;
export type WrongAnswerResolution = (typeof wrongAnswerResolutions)[number];

const ElapsedMilliseconds = Schema.Number.check(
  Schema.isFinite(),
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(maximumElapsedMs),
);

const CardRevision = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(maximumIncrementablePostgresInteger),
);
const ForbiddenField = Schema.optional(Schema.Never);

const SubmitPayloadBase = Schema.Struct({
  cardId: Uuid,
  revision: CardRevision,
  // Which sitting the answer came from. This is provenance for the review
  // log. Scheduling is derived from the server-owned card state.
  mode: Schema.Literals(reviewModes),
  elapsedMs: Schema.optional(ElapsedMilliseconds),
});

const AnsweredPayloadBase = Schema.Struct({
  ...SubmitPayloadBase.fields,
  answer: Schema.String.check(Schema.isMaxLength(maximumSubmittedAnswerLength)),
  // Whether speech recognition wrote the answer. A recited text then forgives
  // words that sound right and numbers in digits.
  dictated: Schema.Boolean,
  skipped: ForbiddenField,
});

export const SubmitPayload = Schema.Union([
  Schema.Struct({
    ...AnsweredPayloadBase.fields,
    wrongAnswerResolution: Schema.Literal('defer'),
  }),
  Schema.Struct({
    ...AnsweredPayloadBase.fields,
    // A resolution must point to the exact rejected server assessment shown
    // to the learner. Re-grading here could change what gets committed.
    wrongAnswerResolution: Schema.Literals(['again', 'hard']),
    assessmentId: Uuid,
  }),
  // The learner gave up without attempting an answer. No answer travels at
  // all: the card is committed as a lapse and the solution is revealed.
  Schema.Struct({
    ...SubmitPayloadBase.fields,
    answer: ForbiddenField,
    dictated: ForbiddenField,
    wrongAnswerResolution: ForbiddenField,
    assessmentId: ForbiddenField,
    skipped: Schema.Literal(true),
  }),
]);

export type SubmitPayloadData = typeof SubmitPayload.Type;
export type AnsweredSubmitData = Exclude<
  SubmitPayloadData,
  { readonly skipped: true }
>;

export const decodeSubmitPayload = Schema.decodeUnknownSync(SubmitPayload);
