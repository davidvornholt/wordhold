import { Effect } from 'effect';
import { AuthenticationError } from './authentication-error';
import { revalidateOwnerSession } from './owner-session';
import { auth } from './server';

export const getOwnerSession = (headers: Headers) =>
  Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: (cause) =>
      new AuthenticationError({
        cause,
        message: 'Die Sitzung konnte nicht geprüft werden.',
      }),
  }).pipe(Effect.flatMap(revalidateOwnerSession));

export const requireSession = (headers: Headers) =>
  getOwnerSession(headers).pipe(
    Effect.flatMap((session) =>
      session === null
        ? Effect.fail(new AuthenticationError({ message: 'Nicht angemeldet.' }))
        : Effect.succeed(session),
    ),
  );
