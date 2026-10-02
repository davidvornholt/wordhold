import { answerDirections } from '@wordhold/db/schema/directions';
import { Option, Schema } from 'effect';
import {
  PlaceSelection,
  VocabularySelection,
} from '../../../shared/session/vocabulary-selection';

// Which way round a sitting asks. The two single values narrow the queue to
// one direction; `both` mixes whatever the course still practises.
export const SessionDirectionSchema = Schema.Literal(
  ...answerDirections,
  'both',
);
export type SessionDirection = typeof SessionDirectionSchema.Type;

// Scheduled practice covers the whole course, or only one book's own words or
// one unit.
export const SessionRequest = Schema.Struct({
  courseId: Schema.UUID,
  direction: SessionDirectionSchema,
  place: Schema.optional(PlaceSelection),
});

export type SessionRequestData = typeof SessionRequest.Type;

export const decodeSessionRequest = Schema.decodeUnknownSync(SessionRequest);

// A hand-picked selection may also practise a direction the course has
// switched off. The overview's Wackelkandidaten come from the directions the
// course still practises, so their sitting stays in those.
export const StudyRequest = Schema.Struct({
  courseId: Schema.UUID,
  direction: SessionDirectionSchema,
  selection: VocabularySelection,
  includeSwitchedOff: Schema.Boolean,
});

export type StudyRequestData = typeof StudyRequest.Type;

export const decodeStudyRequest = Schema.decodeUnknownSync(StudyRequest);

const PracticeSearch = Schema.Struct({
  direction: Schema.optional(SessionDirectionSchema),
  book: Schema.optional(Schema.UUID),
  unit: Schema.optional(Schema.UUID),
});

export type PracticeSearchData = typeof PracticeSearch.Type;

const decodeSearch = Schema.decodeUnknownOption(PracticeSearch);

// A hand-edited or stale URL should not break the screen: an unreadable
// direction falls back to none chosen, which is the start screen.
export const parsePracticeSearch = (input: unknown): PracticeSearchData =>
  Option.getOrElse(decodeSearch(input), (): PracticeSearchData => ({}));

const StudySearch = Schema.Struct({
  direction: Schema.optional(SessionDirectionSchema),
  book: Schema.optional(Schema.UUID),
  unit: Schema.optional(Schema.UUID),
  entries: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.Literal('learn', 'practice')),
  // The selection is the overview's Wackelkandidaten, so the sitting is named
  // after them and leads back to the overview.
  from: Schema.optional(Schema.Literal('fragile')),
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
