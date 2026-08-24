import { getRequest } from '@tanstack/react-start/server';
import { auth } from './server';

// Every server function and API handler for course data goes through this
// gate; better-auth already guarantees only the allowlisted GitHub account
// ever holds a session.
export const requireSession = async () => {
  const session = await auth.api.getSession({
    headers: getRequest().headers,
  });
  if (session === null) {
    throw new Error('Nicht angemeldet.');
  }
  return session;
};
