import { makeDrizzle } from '@wordhold/db/drizzle';
import { account } from '@wordhold/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { serverEnv } from '../env/server';

const db = makeDrizzle(serverEnv.databaseUrl());

// Wordhold is a single-user deployment: GitHub OAuth authenticates, but only
// the allowlisted GitHub account ever receives a session. Blocking at session
// creation keeps the gate in one place regardless of how sign-in evolves.
const assertAllowedUser = async (userId: string): Promise<void> => {
  const rows = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(eq(account.userId, userId));
  const allowed = serverEnv.githubAllowedUserId();
  if (!rows.some((row) => row.accountId === allowed)) {
    throw new Error('This Wordhold instance belongs to someone else.');
  }
};

export const auth = betterAuth({
  secret: serverEnv.authSecret(),
  database: drizzleAdapter(db, { provider: 'pg' }),
  socialProviders: {
    github: {
      clientId: serverEnv.githubClientId(),
      clientSecret: serverEnv.githubClientSecret(),
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await assertAllowedUser(session.userId);
          return { data: session };
        },
      },
    },
  },
});
