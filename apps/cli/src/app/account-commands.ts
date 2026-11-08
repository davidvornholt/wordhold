import { Effect, Option } from 'effect';
import { Command } from 'effect/cli';
import {
  awaitApproval,
  requestDeviceCode,
} from '../features/login/device-login';
import { endSession } from '../features/login/sign-out';
import { SessionStoreFailed } from '../shared/errors/errors';
import { forgetToken, readToken, saveToken } from '../shared/session-store';
import { callWordhold, httpLayer, wordholdLayer } from '../shared/wordhold-api';
import { flag } from './command-inputs';
import { openBrowser } from './open-browser';
import { emit, tell } from './output';
import { currentOrigin } from './root';

const whoAmI = (origin: string) =>
  callWordhold((client) => client.account.me()).pipe(
    Effect.provide(wordholdLayer(origin)),
  );

export const login = Command.make(
  'login',
  {
    noBrowser: flag(
      'no-browser',
      'Print the sign-in link without opening a browser',
    ),
  },
  ({ noBrowser }) =>
    Effect.gen(function* () {
      const origin = yield* currentOrigin;
      const previous = yield* readToken(origin);
      const code = yield* requestDeviceCode(origin);
      yield* tell(
        [
          `To sign in, open ${code.verificationUriComplete}`,
          `and approve the code ${code.userCode}. Waiting for the approval …`,
        ].join('\n'),
      );
      if (!noBrowser) {
        yield* openBrowser(code.verificationUriComplete);
      }
      const token = yield* awaitApproval(origin, code);
      yield* saveToken(origin, token);
      // The new session replaces the old one, which would otherwise stay
      // valid on the server until it expires.
      if (Option.isSome(previous) && previous.value !== token) {
        yield* endSession(origin, previous.value).pipe(Effect.ignore);
      }
      const member = yield* whoAmI(origin);
      yield* emit({ server: origin, signedIn: true, ...member });
    }).pipe(Effect.provide(httpLayer)),
).pipe(
  Command.withDescription(
    'Sign in by approving a code in the browser. Run it yourself in a terminal; it waits up to 15 minutes for the approval.',
  ),
);

export const logout = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const token = yield* readToken(origin);
    if (Option.isSome(token)) {
      // The token leaves this machine even when the server cannot be told,
      // and one that cannot be removed is reported, since it may still sign in.
      const ended = yield* Effect.exit(endSession(origin, token.value));
      yield* forgetToken(origin).pipe(
        Effect.mapError(
          (error) =>
            new SessionStoreFailed({
              message: `The token is still on this machine. ${error.message}${error.message.endsWith('.') ? '' : '.'} Fix or delete that file, then run \`wordhold logout\` again.`,
            }),
        ),
      );
      yield* ended;
    }
    yield* emit({ server: origin, signedIn: false });
  }).pipe(Effect.provide(httpLayer)),
).pipe(
  Command.withDescription(
    'End the session on the server and remove its token from this machine',
  ),
);

export const status = Command.make('status', {}, () =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const member = yield* whoAmI(origin).pipe(
      Effect.map(Option.some),
      Effect.catchTag('NotSignedIn', () => Effect.succeedNone),
    );
    yield* emit(
      Option.match(member, {
        onNone: () => ({ server: origin, signedIn: false }),
        onSome: (signedIn) => ({ server: origin, signedIn: true, ...signedIn }),
      }),
    );
  }).pipe(Effect.provide(httpLayer)),
).pipe(Command.withDescription('Show the server and who is signed in'));
