import { passkey } from '@better-auth/passkey';
import { APIError, getSessionFromCtx } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { Duration } from 'effect';
import { consumeAccessCode, resolveAccessCode } from './access-codes';
import { authDb } from './access-transaction';

// Adding a passkey to an existing account needs a recent sign-in, so an
// unattended open session cannot be used to plant a second credential.
const freshSessionMilliseconds = Duration.toMillis(Duration.minutes(10));

const noAccess = () =>
  new APIError('UNAUTHORIZED', {
    message: 'Dieses Konto hat keinen Zugang mehr.',
  });

export const familyPasskeys = (publicUrl: string) =>
  passkey({
    rpName: 'Wordhold',
    rpID: new URL(publicUrl).hostname,
    origin: new URL(publicUrl).origin,
    authentication: {
      afterVerification: async ({ clientData }) => {
        const rows = await authDb.execute(
          sql`select 1 from passkey p join members m on m.user_id = p.user_id
            where p.credential_id = ${clientData.id} and m.enabled`,
        );
        if (rows.length === 0) {
          throw noAccess();
        }
      },
    },
    registration: {
      // A new person registers with the code from an invitation or recovery
      // link instead of a session.
      requireSession: false,
      resolveUser: ({ context }) => resolveAccessCode(authDb, context ?? null),
      afterVerification: async ({ ctx, user, context }) => {
        if (context) {
          await consumeAccessCode(authDb, context, user.id);
          return { userId: user.id };
        }
        const session = await getSessionFromCtx(ctx);
        if (
          session === null ||
          session.user.id !== user.id ||
          Date.now() - session.session.createdAt.getTime() >
            freshSessionMilliseconds
        ) {
          throw new APIError('UNAUTHORIZED', {
            message: 'Melde dich erneut an, bevor du einen Passkey hinzufügst.',
          });
        }
        const rows = await authDb.execute(
          sql`select 1 from members where user_id = ${user.id} and enabled`,
        );
        if (rows.length === 0) {
          throw noAccess();
        }
        return { userId: user.id };
      },
    },
  });
