import { Effect } from 'effect';
import { AuthenticationError } from './authentication-error';
import { AuthorizationError } from './authorization-error';
import { MemberRepository } from './member-repository';
import { assertOwned, type OwnedReferences } from './ownership';
import { auth } from './server';

// The member behind the request's session, or null. A session that may no
// longer be used is revoked, so a suspended person is signed out everywhere.
export const getMember = (headers: Headers) =>
  Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: (cause) =>
        new AuthenticationError({
          cause,
          message: 'Die Sitzung konnte nicht geprüft werden.',
        }),
    });
    if (session === null) {
      return null;
    }
    const repository = yield* MemberRepository;
    yield* repository.ensureAdministrator;
    const member = yield* repository.authorize(session.user.id);
    if (member === undefined) {
      yield* repository.revokeSession(session.session.token);
      return null;
    }
    return member;
  });

export const requireMember = (headers: Headers) =>
  getMember(headers).pipe(
    Effect.flatMap((member) =>
      member === null
        ? Effect.fail(new AuthenticationError({ message: 'Nicht angemeldet.' }))
        : Effect.succeed(member),
    ),
  );

export const requireAdministrator = (headers: Headers) =>
  requireMember(headers).pipe(
    Effect.filterOrFail(
      (member) => member.admin,
      () =>
        new AuthorizationError({
          message: 'Nur der Administrator kann Konten verwalten.',
        }),
    ),
  );

// The member, after checking that every record the request names belongs to
// one of their courses.
export const requireOwner = (headers: Headers, owned: OwnedReferences) =>
  requireMember(headers).pipe(
    Effect.tap((member) => assertOwned(member.userId, owned)),
  );
