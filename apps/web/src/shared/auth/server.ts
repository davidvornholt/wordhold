import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/server';
import { serverEnv } from '../env/server';
import { assertAllowedUser, mapAllowedGithubProfile } from './owner';
import { authRuntime } from './runtime';

// Wordhold is a single-user deployment: GitHub OAuth authenticates, but only
// the allowlisted GitHub account may be persisted or receive a session.
export const auth = betterAuth({
  secret: serverEnv.authSecret(),
  database: drizzleAdapter(db, { provider: 'pg' }),
  socialProviders: {
    github: {
      clientId: serverEnv.githubClientId(),
      clientSecret: serverEnv.githubClientSecret(),
      mapProfileToUser: mapAllowedGithubProfile,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await authRuntime.runPromise(assertAllowedUser(session.userId));
          return { data: session };
        },
      },
    },
  },
});
