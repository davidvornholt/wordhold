import { Effect } from 'effect';
import { Command } from 'effect/cli';
import { callWordhold } from '../shared/wordhold-api';
import { runApi } from './root';

export const progress = Command.make('progress', {}, () =>
  runApi(Effect.void, () =>
    callWordhold((client) => client.overview.progress()),
  ),
).pipe(
  Command.withDescription(
    'Show practice across all courses: cards ready, answers today, the last seven days, the streak, and the words most often not known',
  ),
);
