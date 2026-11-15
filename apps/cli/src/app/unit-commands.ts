import { AddUnitPayloadSchema } from '@wordhold/api/api';
import { Effect } from 'effect';
import { Command, Flag } from 'effect/cli';
import { callWordhold } from '../shared/wordhold-api';
import { idArgument, validate, validId } from './command-inputs';
import { runApi } from './root';

const add = Command.make(
  'add',
  {
    course: idArgument('Course id', 'course'),
    book: Flag.String('book').pipe(
      Flag.withDescription('The book the unit belongs to'),
    ),
    name: Flag.String('name').pipe(
      Flag.withDescription("The unit's name, unique within its book"),
    ),
  },
  (input) =>
    runApi(
      Effect.all({
        id: validId(input.course),
        payload: validate(
          AddUnitPayloadSchema,
          'unit',
        )({ bookId: input.book.trim(), name: input.name }),
      }),
      ({ id, payload }) =>
        callWordhold((client) =>
          client.courses.addUnit({ params: { id }, payload }),
        ),
    ),
).pipe(
  Command.withDescription(
    'Add a unit at the end of a book of a language course. Prints the new unit.',
  ),
);

export const units = Command.make('units').pipe(
  Command.withDescription('Add units to the books of a language course'),
  Command.withSubcommands([add]),
);
