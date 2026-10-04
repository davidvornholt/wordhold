import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { serverEnv } from '../env/server';
import { authDb, withAccessTransaction } from './access-transaction';
import { mapAllowedGithubProfile } from './github-gate';
import { familyPasskeys } from './passkeys';

// The administrator signs in with the one allowlisted GitHub account; every
// other person signs in with a passkey registered through an invitation.
// Whether a session may still be used is decided per request from `members`.
export const auth = betterAuth({
  baseURL: serverEnv.publicUrl(),
  secret: serverEnv.authSecret(),
  database: drizzleAdapter(authDb, { provider: 'pg', transaction: false }),
  socialProviders: {
    github: {
      clientId: serverEnv.githubClientId(),
      clientSecret: serverEnv.githubClientSecret(),
      mapProfileToUser: mapAllowedGithubProfile,
    },
  },
  plugins: [familyPasskeys(serverEnv.publicUrl())],
});

export const handleAuth = (request: Request): Promise<Response> =>
  withAccessTransaction(() => auth.handler(request));
