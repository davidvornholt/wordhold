import { getRequest } from '@tanstack/react-start/server';
import { session as sessionTable } from '@wordhold/db/schema/auth';
import { eq } from 'drizzle-orm';
import { db } from '../db/server';
import { revalidateOwnerSession } from './owner-session';
import { auth, isAllowedUser } from './server';

export const getOwnerSession = async () => {
  const session = await auth.api.getSession({
    headers: getRequest().headers,
  });
  return revalidateOwnerSession(session, {
    isAllowedUser,
    revokeSession: async (token) => {
      await db.delete(sessionTable).where(eq(sessionTable.token, token));
    },
  });
};

// Every server function and API handler for course data goes through this
// gate. Revalidation keeps an existing session from surviving an owner change.
export const requireSession = async () => {
  const session = await getOwnerSession();
  if (session === null) {
    throw new Error('Nicht angemeldet.');
  }
  return session;
};
