import {
  CreateExamPayloadSchema,
  EditExamPayloadSchema,
} from '@wordhold/api/api';
import { directions } from '@wordhold/api/vocabulary';
import { Effect, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { callWordhold } from '../shared/wordhold-api';
import {
  fail,
  flag,
  idArgument,
  optionalString,
  validate,
  validId,
} from './command-inputs';
import { runApi } from './root';

// Each flag names one id, so a test's words can come from several units.
const idsFlag = (name: string, description: string) =>
  Flag.String(name).pipe(
    Flag.withDescription(description),
    Flag.atLeast(0),
    Flag.map((ids) => ids.map((id) => id.trim())),
  );

const directionsFlag = (description: string) =>
  Flag.Literals('direction', directions).pipe(
    Flag.withDescription(
      `${description} The values are those of the course's directions: to_target asks for the word in the course's language, to_native for its German meaning.`,
    ),
    Flag.atLeast(0),
  );

// An empty list leaves the field out of the request.
const nonEmpty = <A>(values: ReadonlyArray<A>) =>
  values.length === 0 ? undefined : values;

const archivedOf = (archive: boolean, unarchive: boolean) => {
  if (archive) {
    return true;
  }
  return unarchive ? false : undefined;
};

const list = Command.make(
  'list',
  { course: idArgument('Course id', 'course') },
  ({ course }) =>
    runApi(validId(course), (id) =>
      callWordhold((client) => client.exams.list({ params: { id } })),
    ),
).pipe(
  Command.withDescription(
    "List a course's tests, active ones first, each with its newest finished round",
  ),
);

const get = Command.make('get', { id: idArgument('Test id') }, ({ id }) =>
  runApi(validId(id), (valid) =>
    callWordhold((client) => client.exams.get({ params: { id: valid } })),
  ),
).pipe(
  Command.withDescription(
    'Show a test: its words, its learned and unlearned cards, its rounds, and the last two finished rounds with the cards missed in the newest',
  ),
);

const create = Command.make(
  'create',
  {
    course: idArgument('Course id', 'course'),
    name: Flag.String('name').pipe(
      Flag.withDescription('The name, such as "Vokabeltest Unit 3"'),
    ),
    directions: directionsFlag(
      'A direction the test asks. Repeat it for more.',
    ),
    entries: idsFlag('entry', 'An entry the test asks. Repeat it for more.'),
    units: idsFlag(
      'unit',
      'A unit whose words the test asks, all of them. Repeat it for more.',
    ),
  },
  (input) =>
    runApi(
      Effect.gen(function* () {
        const id = yield* validId(input.course);
        if (input.directions.length === 0) {
          return yield* fail('Pass at least one --direction.');
        }
        if (input.entries.length === 0 && input.units.length === 0) {
          return yield* fail('A test needs words. Pass --entry or --unit.');
        }
        const payload = yield* validate(
          CreateExamPayloadSchema,
          'test',
        )({
          name: input.name,
          directions: input.directions,
          entryIds: nonEmpty(input.entries),
          unitIds: nonEmpty(input.units),
        });
        return { id, payload };
      }),
      ({ id, payload }) =>
        callWordhold((client) =>
          client.exams.create({ params: { id }, payload }),
        ),
    ),
).pipe(
  Command.withDescription(
    "Create a test of a course's words: the entries given and every word of the units given. Prints the new test.",
  ),
);

const edit = Command.make(
  'edit',
  {
    id: idArgument('Test id'),
    name: optionalString('name', 'The new name'),
    directions: directionsFlag(
      "A direction the test asks; together they replace the test's directions. Repeat it for more.",
    ),
    addEntries: idsFlag('add-entry', 'Add this entry. Repeat it for more.'),
    removeEntries: idsFlag(
      'remove-entry',
      'Remove this entry. Repeat it for more.',
    ),
    addUnits: idsFlag(
      'add-unit',
      'Add every word of this unit. Repeat it for more.',
    ),
    removeUnits: idsFlag(
      'remove-unit',
      'Remove every word of this unit. Repeat it for more.',
    ),
    archive: flag(
      'archive',
      'Archive the test: it keeps its rounds and starts no new one',
    ),
    unarchive: flag('unarchive', 'Bring an archived test back'),
  },
  (input) =>
    runApi(
      Effect.gen(function* () {
        const id = yield* validId(input.id);
        if (input.archive && input.unarchive) {
          return yield* fail('Pass either --archive or --unarchive.');
        }
        const changes = {
          name: Option.getOrUndefined(input.name),
          directions: nonEmpty(input.directions),
          addEntryIds: nonEmpty(input.addEntries),
          removeEntryIds: nonEmpty(input.removeEntries),
          addUnitIds: nonEmpty(input.addUnits),
          removeUnitIds: nonEmpty(input.removeUnits),
          archived: archivedOf(input.archive, input.unarchive),
        };
        if (Object.values(changes).every((value) => value === undefined)) {
          return yield* fail(
            'Nothing to change. Pass a name, directions, words to add or remove, or --archive; see --help.',
          );
        }
        const payload = yield* validate(
          EditExamPayloadSchema,
          'change',
        )(changes);
        return { id, payload };
      }),
      ({ id, payload }) =>
        callWordhold((client) =>
          client.exams.edit({ params: { id }, payload }),
        ),
    ),
).pipe(
  Command.withDescription(
    'Change a test. Only what is given changes; words are added before any are removed. Rounds already started keep their cards. Prints the test.',
  ),
);

export const exams = Command.make('exams').pipe(
  Command.withDescription(
    "Create and change a course's tests and read how their rounds went. Rounds are practised in the app.",
  ),
  Command.withSubcommands([list, get, create, edit]),
);
