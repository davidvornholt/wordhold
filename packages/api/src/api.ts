import { Schema } from 'effect';
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { Authorization } from './authorization';
import { failures } from './errors/api-errors';
import {
  CourseOutlineSchema,
  CourseSchema,
  EntryFilterSchema,
  EntrySchema,
  IdSchema,
  MemberSchema,
  ProgressSchema,
  SavedEntrySchema,
} from './vocabulary';

/** The app's own limits; a word or term is short, a text may be long. */
export const entryTextLength = 500;
export const memorizedTextLength = 4000;
export const exampleLength = 1000;
/** How many entries a search returns at most, best matches first. */
export const searchLimit = 50;

const text = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

const idParams = { id: IdSchema };

// The request bodies are exported so a client can check its input before
// sending it. Limits that depend on the course's kind are checked by the
// server.

export const ExamplePayloadSchema = Schema.Struct({
  targetText: text(exampleLength),
  nativeText: Schema.optional(text(exampleLength)),
});

/**
 * A new word, term or text. A word goes into a unit or directly into a book;
 * without either, it goes where the last word of the course went, as in the
 * app. Terms and texts take neither, and no example.
 */
export const AddEntryPayloadSchema = Schema.Struct({
  targetText: text(entryTextLength),
  nativeText: text(memorizedTextLength),
  bookId: Schema.optional(IdSchema),
  unitId: Schema.optional(IdSchema),
  example: Schema.optional(ExamplePayloadSchema),
});
export type AddEntryPayload = typeof AddEntryPayloadSchema.Type;

// Synonyms or antonyms of a word, in the course's language. The server checks
// how many a word may have.
const relatedWords = Schema.Array(text(entryTextLength));

/**
 * Changes only the fields given. A null example removes the stored one. A
 * word's synonyms or antonyms replace its stored list, and an empty list
 * removes them; terms and texts have neither.
 */
export const EditEntryPayloadSchema = Schema.Struct({
  targetText: Schema.optional(text(entryTextLength)),
  nativeText: Schema.optional(text(memorizedTextLength)),
  example: Schema.optional(Schema.NullOr(ExamplePayloadSchema)),
  synonyms: Schema.optional(relatedWords),
  antonyms: Schema.optional(relatedWords),
});
export type EditEntryPayload = typeof EditEntryPayloadSchema.Type;

export const SearchQuerySchema = text(entryTextLength);

export const AccountApi = HttpApiGroup.make('account').add(
  HttpApiEndpoint.get('me', '/me', { success: MemberSchema, error: failures }),
);

/** One course, with the books and units its words live in. */
export const CoursesApi = HttpApiGroup.make('courses')
  .add(
    HttpApiEndpoint.get('get', '/:id', {
      params: idParams,
      success: CourseOutlineSchema,
      error: failures,
    }),
    /** The course's entries in course order, optionally of one book or unit. */
    HttpApiEndpoint.get('entries', '/:id/entries', {
      params: idParams,
      query: {
        filter: Schema.optional(EntryFilterSchema),
        book: Schema.optional(IdSchema),
        unit: Schema.optional(IdSchema),
      },
      success: Schema.Array(EntrySchema),
      error: failures,
    }),
    HttpApiEndpoint.post('add', '/:id/entries', {
      params: idParams,
      payload: AddEntryPayloadSchema,
      success: SavedEntrySchema,
      error: failures,
    }),
  )
  .prefix('/courses');

export const EntriesApi = HttpApiGroup.make('entries')
  .add(
    /** Entries whose texts, example, synonyms or antonyms contain the query, ignoring case and accents. */
    HttpApiEndpoint.get('search', '/', {
      query: {
        query: SearchQuerySchema,
        course: Schema.optional(IdSchema),
      },
      success: Schema.Array(EntrySchema),
      error: failures,
    }),
    HttpApiEndpoint.get('get', '/:id', {
      params: idParams,
      success: EntrySchema,
      error: failures,
    }),
    HttpApiEndpoint.patch('edit', '/:id', {
      params: idParams,
      payload: EditEntryPayloadSchema,
      success: SavedEntrySchema,
      error: failures,
    }),
  )
  .prefix('/entries');

/** What the app's overview shows: every course with its numbers, and practice across them. */
export const OverviewApi = HttpApiGroup.make('overview').add(
  HttpApiEndpoint.get('courses', '/courses', {
    success: Schema.Array(CourseSchema),
    error: failures,
  }),
  HttpApiEndpoint.get('progress', '/progress', {
    success: ProgressSchema,
    error: failures,
  }),
);

export const apiPrefix = '/api/cli';

export class WordholdApi extends HttpApi.make('wordhold')
  .add(AccountApi)
  .add(CoursesApi)
  .add(EntriesApi)
  .add(OverviewApi)
  .middleware(Authorization)
  .prefix(apiPrefix) {}
