import { Schema } from 'effect';

/**
 * Vocabulary as the API shows it to a client such as the CLI. These shapes
 * are the wire contract: the web app maps its own views onto them, so a field
 * added here is a promise to every client. Instants are ISO 8601 strings in
 * UTC.
 */

export const IdSchema = Schema.String.check(Schema.isUUID());

export const languages = ['de', 'en', 'es', 'fr'] as const;
export const LanguageSchema = Schema.Literals(languages);

/**
 * A `language` course pairs foreign words with German ones. A `terms` course
 * pairs German terms with their definitions, and a `texts` course pairs
 * titles with texts learned word for word.
 */
export const courseKinds = ['language', 'terms', 'texts'] as const;
export const CourseKindSchema = Schema.Literals(courseKinds);
export type CourseKind = typeof CourseKindSchema.Type;

export const directions = [
  'to_target',
  'to_native',
  'to_synonym',
  'to_antonym',
] as const;
export const DirectionSchema = Schema.Literals(directions);

export const cardStates = ['new', 'learning', 'review', 'relearning'] as const;
export const CardStateSchema = Schema.Literals(cardStates);

export const exampleSources = ['textbook', 'generated'] as const;

/** The app's own vocabulary filters. */
export const entryFilters = ['due', 'first-reviews', 'difficult'] as const;
export const EntryFilterSchema = Schema.Literals(entryFilters);
export type EntryFilter = typeof EntryFilterSchema.Type;

const Instant = Schema.String;
const Count = Schema.Number;

export const MemberSchema = Schema.Struct({
  name: Schema.String,
  admin: Schema.Boolean,
});

export const DirectionStatsSchema = Schema.Struct({
  direction: DirectionSchema,
  due: Count,
  firstReviews: Count,
  ready: Count,
  nextDueAt: Schema.NullOr(Instant),
});

/** A course with the numbers the overview shows for it. */
export const CourseSchema = Schema.Struct({
  id: IdSchema,
  name: Schema.String,
  kind: CourseKindSchema,
  targetLanguage: LanguageSchema,
  entries: Count,
  known: Count,
  unintroduced: Count,
  due: Count,
  firstReviews: Count,
  ready: Count,
  nextDueAt: Schema.NullOr(Instant),
  directions: Schema.Array(DirectionStatsSchema),
});
export type Course = typeof CourseSchema.Type;

const placeFields = {
  id: IdSchema,
  name: Schema.String,
  entries: Count,
  introduced: Count,
  unintroduced: Count,
  due: Count,
  firstReviews: Count,
  nextDueAt: Schema.NullOr(Instant),
};

export const UnitSchema = Schema.Struct(placeFields);

/** A book's numbers cover only the words that live directly in it. */
export const BookSchema = Schema.Struct({
  ...placeFields,
  units: Schema.Array(UnitSchema),
});

/** Terms and texts have no books, so their outline lists none. */
export const CourseOutlineSchema = Schema.Struct({
  id: IdSchema,
  name: Schema.String,
  kind: CourseKindSchema,
  targetLanguage: LanguageSchema,
  directions: Schema.Array(DirectionSchema),
  books: Schema.Array(BookSchema),
});
export type CourseOutline = typeof CourseOutlineSchema.Type;

export const CardSchema = Schema.Struct({
  direction: DirectionSchema,
  state: CardStateSchema,
  dueAt: Schema.NullOr(Instant),
  introducedAt: Schema.NullOr(Instant),
  /** Answers rated Again: not known. */
  failures: Count,
  /** Answers rated Hard: right, but only just. */
  hardAnswers: Count,
});

const PlaceRefSchema = Schema.Struct({ id: IdSchema, name: Schema.String });

export const ExampleSchema = Schema.Struct({
  targetText: Schema.String,
  nativeText: Schema.NullOr(Schema.String),
  source: Schema.Literals(exampleSources),
});

/**
 * One entry. For a word, `targetText` is in the course's language and
 * `nativeText` in German; for a term they are the term and its definition,
 * and for a text its title and the text itself.
 */
export const EntrySchema = Schema.Struct({
  id: IdSchema,
  course: Schema.Struct({
    id: IdSchema,
    name: Schema.String,
    kind: CourseKindSchema,
  }),
  book: Schema.NullOr(PlaceRefSchema),
  unit: Schema.NullOr(PlaceRefSchema),
  targetText: Schema.String,
  nativeText: Schema.String,
  example: Schema.NullOr(ExampleSchema),
  synonyms: Schema.NullOr(Schema.Array(Schema.String)),
  antonyms: Schema.NullOr(Schema.Array(Schema.String)),
  keyPoints: Schema.NullOr(Schema.Array(Schema.String)),
  introduced: Schema.Boolean,
  cards: Schema.Array(CardSchema),
});
export type Entry = typeof EntrySchema.Type;

/**
 * A saved entry. `audio` says whether the word's pronunciation was recorded
 * again; it is null for terms and texts, which have none.
 */
export const SavedEntrySchema = Schema.Struct({
  entry: EntrySchema,
  audio: Schema.NullOr(Schema.Literals(['generated', 'failed', 'kept'])),
});
export type SavedEntry = typeof SavedEntrySchema.Type;

export const FragileEntrySchema = Schema.Struct({
  entryId: IdSchema,
  courseId: IdSchema,
  courseName: Schema.String,
  targetText: Schema.String,
  nativeText: Schema.String,
  failures: Count,
});

export const PracticeDaySchema = Schema.Struct({
  day: Schema.String,
  practiced: Schema.Boolean,
});

/** Practice across all courses, by days in the owner's time zone. */
export const ProgressSchema = Schema.Struct({
  ready: Count,
  reviewsToday: Count,
  cardsToday: Count,
  streak: Count,
  week: Schema.Array(PracticeDaySchema),
  fragile: Schema.Array(FragileEntrySchema),
});
export type Progress = typeof ProgressSchema.Type;
