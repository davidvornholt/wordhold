import { Authorization } from '@wordhold/api/authorization';
import { CurrentMember, type Member } from '@wordhold/api/current-member';
import { Unauthorized } from '@wordhold/api/errors';
import { Effect, Layer, Redacted } from 'effect';

type Authorize = (headers: Headers) => Promise<Member | null>;

/**
 * Resolves the bearer token to the member it belongs to. Better Auth's bearer
 * plugin reads the token from the Authorization header, so the web app's
 * session check, including the suspension check, decides who may pass.
 */
export const apiAuthorization = (authorize: Authorize) =>
  Layer.succeed(
    Authorization,
    Authorization.of({
      bearer: (httpEffect, { credential }) =>
        Effect.gen(function* () {
          const member = yield* Effect.promise(() =>
            authorize(
              new Headers({
                authorization: `Bearer ${Redacted.value(credential)}`,
              }),
            ),
          );
          if (member === null) {
            return yield* new Unauthorized({
              message: 'Not signed in. Run `wordhold login`.',
            });
          }
          return yield* Effect.provideService(
            httpEffect,
            CurrentMember,
            member,
          );
        }),
    }),
  );
