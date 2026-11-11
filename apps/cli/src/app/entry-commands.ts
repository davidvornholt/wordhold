import {
  AddEntryPayloadSchema,
  EditEntryPayloadSchema,
  SearchQuerySchema,
} from '@wordhold/api/api';
import { entryFilters } from '@wordhold/api/vocabulary';
import { Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { callWordhold } from '../shared/wordhold-api';
import {
  fail,
  flag,
  idArgument,
  once,
  optionalString,
  validate,
  validId,
} from './command-inputs';
import { runApi } from './root';

const optionalId = (value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => Effect.succeed(undefined),
    onSome: validId,
  });

const exampleFlags = {
  example: optionalString(
    'example',
    "An example sentence in the course's language (words only)",
  ),
  exampleTranslation: optionalString(
    'example-translation',
    'The example sentence in German; needs --example',
  ),
};

// Each flag adds one word, so a word may contain a comma.
const relatedWordsFlag = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.atLeast(0));

const relationFlags = {
  synonyms: relatedWordsFlag(
    'synonym',
    "A synonym in the course's language (words only). Repeat it for more; together they replace the stored synonyms.",
  ),
  antonyms: relatedWordsFlag(
    'antonym',
    "An antonym in the course's language (words only). Repeat it for more; together they replace the stored antonyms.",
  ),
  noSynonyms: flag(
    'no-synonyms',
    'Remove the synonyms, with the practice card that asks for them',
  ),
  noAntonyms: flag(
    'no-antonyms',
    'Remove the antonyms, with the practice card that asks for them',
  ),
};

// The list an edit sends: the words given, an empty list to remove them, or
// nothing to keep the stored ones.
const relatedWordsOf = (
  words: ReadonlyArray<string>,
  remove: boolean,
  name: string,
) => {
  if (remove && words.length > 0) {
    return fail(`Pass either --${name} or --no-${name}s.`);
  }
  if (remove) {
    return Effect.succeed([]);
  }
  return Effect.succeed(words.length === 0 ? undefined : words);
};

type ExampleInput = {
  readonly example: Option.Option<string>;
  readonly exampleTranslation: Option.Option<string>;
};

const exampleOf = ({ example, exampleTranslation }: ExampleInput) =>
  Option.match(example, {
    onNone: () =>
      Option.isSome(exampleTranslation)
        ? fail('--example-translation needs --example.')
        : Effect.succeed(undefined),
    onSome: (targetText) =>
      Effect.succeed({
        targetText,
        ...Option.match(exampleTranslation, {
          onNone: () => ({}),
          onSome: (nativeText) => ({ nativeText }),
        }),
      }),
  });

const list = Command.make(
  'list',
  {
    course: idArgument('Course id', 'course'),
    book: optionalString(
      'book',
      'Only the words of this book, including those in its units',
    ),
    unit: optionalString('unit', 'Only the words of this unit'),
    filter: once(
      Flag.Literals('filter', entryFilters).pipe(
        Flag.withDescription(
          'due: due for review; first-reviews: learned, waiting for their first review; difficult: not known or right only just at least once',
        ),
      ),
    ),
  },
  ({ course, book, unit, filter }) =>
    runApi(
      Effect.all({
        id: validId(course),
        book: optionalId(book),
        unit: optionalId(unit),
      }),
      (valid) =>
        callWordhold((client) =>
          client.courses.entries({
            params: { id: valid.id },
            query: {
              book: valid.book,
              unit: valid.unit,
              filter: Option.getOrUndefined(filter),
            },
          }),
        ),
    ),
).pipe(
  Command.withDescription(
    "List a course's entries in course order, with their example and practice cards",
  ),
);

const search = Command.make(
  'search',
  {
    text: Argument.String('text').pipe(
      Argument.withDescription('Text to look for'),
    ),
    course: optionalString('course', 'Search only this course'),
  },
  ({ text, course }) =>
    runApi(
      Effect.all({
        query: validate(SearchQuerySchema, 'search text')(text),
        course: optionalId(course),
      }),
      (query) => callWordhold((client) => client.entries.search({ query })),
    ),
).pipe(
  Command.withDescription(
    'Find entries in all courses whose texts, example, synonyms or antonyms contain the text, ignoring case and accents. Best matches first, at most 50.',
  ),
);

const get = Command.make('get', { id: idArgument('Entry id') }, ({ id }) =>
  runApi(validId(id), (valid) =>
    callWordhold((client) => client.entries.get({ params: { id: valid } })),
  ),
).pipe(Command.withDescription('Show one entry'));

const add = Command.make(
  'add',
  {
    course: idArgument('Course id', 'course'),
    target: Flag.String('target').pipe(
      Flag.withDescription(
        "The word in the course's language, the term, or the text's title",
      ),
    ),
    native: Flag.String('native').pipe(
      Flag.withDescription(
        'The German word, the definition, or the text itself',
      ),
    ),
    book: optionalString(
      'book',
      'Put the word directly into this book (words only)',
    ),
    unit: optionalString('unit', 'Put the word into this unit (words only)'),
    ...exampleFlags,
  },
  (input) =>
    runApi(
      Effect.gen(function* () {
        const id = yield* validId(input.course);
        const example = yield* exampleOf(input);
        const payload = yield* validate(
          AddEntryPayloadSchema,
          'entry',
        )({
          targetText: input.target,
          nativeText: input.native,
          ...(Option.isSome(input.book) ? { bookId: input.book.value } : {}),
          ...(Option.isSome(input.unit) ? { unitId: input.unit.value } : {}),
          ...(example === undefined ? {} : { example }),
        });
        return { id, payload };
      }),
      ({ id, payload }) =>
        callWordhold((client) =>
          client.courses.add({ params: { id }, payload }),
        ),
    ),
).pipe(
  Command.withDescription(
    'Add a word, term or text to a course. Without --book or --unit, a word goes where the last word of the course went. Prints the saved entry.',
  ),
);

const edit = Command.make(
  'edit',
  {
    id: idArgument('Entry id'),
    target: optionalString(
      'target',
      "The word in the course's language, the term, or the text's title",
    ),
    native: optionalString(
      'native',
      'The German word, the definition, or the text itself',
    ),
    ...exampleFlags,
    noExample: flag('no-example', 'Remove the example sentence'),
    ...relationFlags,
  },
  (input) =>
    runApi(
      Effect.gen(function* () {
        const id = yield* validId(input.id);
        if (input.noExample && Option.isSome(input.example)) {
          return yield* fail('Pass either --example or --no-example.');
        }
        const example = input.noExample ? null : yield* exampleOf(input);
        const synonyms = yield* relatedWordsOf(
          input.synonyms,
          input.noSynonyms,
          'synonym',
        );
        const antonyms = yield* relatedWordsOf(
          input.antonyms,
          input.noAntonyms,
          'antonym',
        );
        const changes = {
          ...Option.match(input.target, {
            onNone: () => ({}),
            onSome: (targetText) => ({ targetText }),
          }),
          ...Option.match(input.native, {
            onNone: () => ({}),
            onSome: (nativeText) => ({ nativeText }),
          }),
          ...(example === undefined ? {} : { example }),
          ...(synonyms === undefined ? {} : { synonyms }),
          ...(antonyms === undefined ? {} : { antonyms }),
        };
        if (Object.keys(changes).length === 0) {
          return yield* fail(
            'Nothing to change. Pass a text, an example, synonyms or antonyms; see --help.',
          );
        }
        const payload = yield* validate(
          EditEntryPayloadSchema,
          'change',
        )(changes);
        return { id, payload };
      }),
      ({ id, payload }) =>
        callWordhold((client) =>
          client.entries.edit({ params: { id }, payload }),
        ),
    ),
).pipe(
  Command.withDescription(
    'Change an entry. Only the fields given change; a new example replaces the old one, and synonyms or antonyms replace the stored list. Prints the saved entry.',
  ),
);

export const entries = Command.make('entries').pipe(
  Command.withDescription('Find, read, add and change words, terms and texts'),
  Command.withSubcommands([list, search, get, add, edit]),
);
