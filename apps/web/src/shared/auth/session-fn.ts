import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getOwnerSession } from './require-session';
import { authRuntime } from './runtime';

// Unlike requireSession, this never throws: the landing page uses it to
// decide between the sign-in card and the course overview.
export const getSessionUser = createServerFn().handler(async () => {
  const session = await authRuntime.runPromise(
    getOwnerSession(getRequest().headers),
  );
  return session === null ? null : { name: session.user.name };
});
