import { Config, Effect, Layer, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { defaultServer, serverOrigin } from '../shared/server';
import { httpLayer, wordholdLayer } from '../shared/wordhold-api';
import { emit } from './output';

const server = Flag.String('server').pipe(
  Flag.withDescription(
    `The Wordhold server. Defaults to $WORDHOLD_SERVER, else ${defaultServer}.`,
  ),
  Flag.withFallbackConfig(Config.NonEmptyString('WORDHOLD_SERVER')),
  Flag.optional,
);

export const root = Command.make('wordhold').pipe(
  Command.withSharedFlags({ server }),
  Command.withDescription(
    'Read and add to your Wordhold vocabulary: courses, words, terms and texts, and how practice is going. Prints JSON.',
  ),
);

/** The origin of the server the command talks to. */
export const currentOrigin = Effect.flatMap(root, ({ server: chosen }) =>
  serverOrigin(Option.getOrElse(chosen, () => defaultServer)),
);

export const signedInLayer = (origin: string) =>
  wordholdLayer(origin).pipe(Layer.provideMerge(httpLayer));

// Checks a command's input, then sends its request to the signed-in server
// and prints the result. The session is read only after the input passes, so
// `--help` never touches it and a mistake in the input is reported as one even
// when nobody is signed in.
export const runApi = <I, A, E1, E2, R1, R2>(
  input: Effect.Effect<I, E1, R1>,
  request: (input: I) => Effect.Effect<A, E2, R2>,
) =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const valid = yield* input;
    const data = yield* request(valid).pipe(
      Effect.provide(signedInLayer(origin)),
    );
    yield* emit(data);
  });
