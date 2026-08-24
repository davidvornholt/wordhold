import { createServerFn } from '@tanstack/react-start';
import { getOwnerSession } from './require-session';

// Unlike requireSession, this never throws: the landing page uses it to
// decide between the sign-in card and the course overview.
export const getSessionUser = createServerFn().handler(async () => {
  const session = await getOwnerSession();
  return session === null ? null : { name: session.user.name };
});
