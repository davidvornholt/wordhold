import { passkeyClient } from '@better-auth/passkey/client';
import { deviceAuthorizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { AuthenticationError } from './authentication-error';

export const authClient = createAuthClient({
  plugins: [passkeyClient(), deviceAuthorizationClient()],
});

// Better Auth's client reports failures in the result instead of throwing;
// this turns them into a rejection the calling form can show.
export const rejectAuthError = <Result extends { readonly error: unknown }>(
  result: Result,
): Result => {
  if (result.error !== null) {
    throw new AuthenticationError({
      cause: result.error,
      message: 'Die Anmeldung wurde nicht abgeschlossen.',
    });
  }
  return result;
};
