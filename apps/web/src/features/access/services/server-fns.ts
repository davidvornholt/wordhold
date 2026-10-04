import { createServerFn } from '@tanstack/react-start';
import { Database, PgLive } from '@wordhold/db/client';
import { Effect, ManagedRuntime } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import { PasskeyListError } from '../errors/access-errors';
import type { OwnPasskey } from '../schemas/passkey-models';

const accessRuntime = ManagedRuntime.make(PgLive);

// Better Auth lists passkeys only from the browser; reading them here lets
// the page render them on the server like every other page.
export const listOwnPasskeys = createServerFn().handler(async () => {
  const member = await requestMember();
  return accessRuntime.runPromise(
    Effect.flatMap(
      Database,
      (sql) => sql<OwnPasskey>`
        select id, name, created_at as "createdAt", backed_up as "backedUp"
        from passkey where user_id = ${member.userId}
        order by created_at, id
      `,
    ).pipe(
      Effect.mapError(
        (cause) =>
          new PasskeyListError({
            cause,
            message: 'Deine Passkeys konnten nicht geladen werden.',
          }),
      ),
    ),
  );
});
