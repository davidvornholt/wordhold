import { Effect } from 'effect';
import { Command } from 'effect/cli';
import { callWordhold } from '../shared/wordhold-api';
import { idArgument, validId } from './command-inputs';
import { runApi } from './root';

const list = Command.make('list', {}, () =>
  runApi(Effect.void, () =>
    callWordhold((client) => client.overview.courses()),
  ),
).pipe(
  Command.withDescription(
    'List your courses with what is due, ready to practise, and not yet learned',
  ),
);

const get = Command.make('get', { id: idArgument('Course id') }, ({ id }) =>
  runApi(validId(id), (valid) =>
    callWordhold((client) => client.courses.get({ params: { id: valid } })),
  ),
).pipe(
  Command.withDescription(
    "Show a course's practised directions and its books and units with their progress",
  ),
);

export const courses = Command.make('courses').pipe(
  Command.withDescription(
    'Read your courses: languages, subjects of terms, and collections of texts',
  ),
  Command.withSubcommands([list, get]),
);
