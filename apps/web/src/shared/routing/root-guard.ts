import { redirect } from '@tanstack/react-router';

type SessionUser = {
  readonly name: string;
};

const isOwnerRoute = (pathname: string): boolean =>
  pathname.startsWith('/courses/') || pathname.startsWith('/pages/');

export const redirectExpiredOwnerRoute = async (
  pathname: string,
  getSessionUser: () => Promise<SessionUser | null>,
): Promise<void> => {
  if (!isOwnerRoute(pathname)) {
    return;
  }
  if ((await getSessionUser()) === null) {
    throw redirect({ to: '/' });
  }
};
