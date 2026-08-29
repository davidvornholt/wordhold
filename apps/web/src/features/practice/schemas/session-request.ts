import { answerDirections } from '@wordhold/db/schema/directions';
import { Option, Schema } from 'effect';

// Which way round a sitting asks. The two single values narrow the queue to
// one direction; `both` mixes whatever the course still practises.
export const SessionDirectionSchema = Schema.Literal(
  ...answerDirections,
  'both',
);
export type SessionDirection = typeof SessionDirectionSchema.Type;

export const SessionRequest = Schema.Struct({
  courseId: Schema.UUID,
  direction: SessionDirectionSchema,
});

export type SessionRequestData = typeof SessionRequest.Type;

export const decodeSessionRequest = Schema.decodeUnknownSync(SessionRequest);

const StudySelection = Schema.Union(
  Schema.Struct({ unitId: Schema.UUID }),
  Schema.Struct({
    entryIds: Schema.Array(Schema.UUID).pipe(Schema.minItems(1)),
  }),
);

export const StudyRequest = Schema.Struct({
  courseId: Schema.UUID,
  direction: SessionDirectionSchema,
  selection: StudySelection,
});

export type StudyRequestData = typeof StudyRequest.Type;

export const decodeStudyRequest = Schema.decodeUnknownSync(StudyRequest);

const PracticeSearch = Schema.Struct({
  direction: Schema.optional(SessionDirectionSchema),
});

export type PracticeSearchData = typeof PracticeSearch.Type;

const decodeSearch = Schema.decodeUnknownOption(PracticeSearch);

// A hand-edited or stale URL should not break the screen: an unreadable
// direction falls back to none chosen, which is the start screen.
export const parsePracticeSearch = (input: unknown): PracticeSearchData =>
  Option.getOrElse(decodeSearch(input), (): PracticeSearchData => ({}));

const StudySearch = Schema.Struct({
  direction: Schema.optional(SessionDirectionSchema),
  unit: Schema.optional(Schema.UUID),
  entries: Schema.optional(Schema.String),
});

export type StudySearchData = typeof StudySearch.Type;

const decodeStudySearch = Schema.decodeUnknownOption(StudySearch);

export const parseStudySearch = (input: unknown): StudySearchData =>
  Option.getOrElse(decodeStudySearch(input), (): StudySearchData => ({}));

export const selectedEntryIds = (
  entries: string | undefined,
): ReadonlyArray<string> =>
  entries === undefined
    ? []
    : entries.split(',').filter((entryId) => Schema.is(Schema.UUID)(entryId));
