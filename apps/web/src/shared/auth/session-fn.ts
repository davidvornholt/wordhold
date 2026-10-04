import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getMember } from './require-member';
import { authRuntime } from './runtime';

// Unlike requireMember, this never throws: the landing page uses it to
// decide between the sign-in card and the course overview.
export const getSessionUser = createServerFn().handler(async () => {
  const member = await authRuntime.runPromise(getMember(getRequest().headers));
  return member === null ? null : { name: member.name, admin: member.admin };
});
