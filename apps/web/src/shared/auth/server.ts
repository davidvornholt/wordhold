import { account } from '@wordhold/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/server';
import { serverEnv } from '../env/server';
import { assertAllowedUser, mapAllowedGithubProfile } from './owner';

// Wordhold is a single-user deployment: GitHub OAuth authenticates, but only
// the allowlisted GitHub account may be persisted or receive a session.
export const isAllowedUser = async (userId: string): Promise<boolean> => {
  const [matchingAccount] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'github'),
        eq(account.accountId, serverEnv.githubAllowedUserId()),
      ),
    )
    .limit(1);
  return matchingAccount !== undefined;
};

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
          await assertAllowedUser(session.userId, isAllowedUser);
          return { data: session };
        },
      },
    },
  },
});
