import { redirect } from '@tanstack/react-router';

type SessionUser = {
  readonly name: string;
  readonly admin: boolean;
};

const isAdministratorRoute = (pathname: string): boolean =>
  pathname === '/people' || pathname.startsWith('/people/');

const isMemberRoute = (pathname: string): boolean =>
  pathname.startsWith('/courses/') ||
  pathname.startsWith('/imports/') ||
  pathname.startsWith('/pages/') ||
  pathname === '/passkeys';

// Sends someone whose session expired, or who is not the administrator on an
// administrator page, back to the overview before any loader runs.
export const redirectUnauthorizedRoute = async (
  pathname: string,
  getSessionUser: () => Promise<SessionUser | null>,
): Promise<void> => {
  const administratorRoute = isAdministratorRoute(pathname);
  if (!(administratorRoute || isMemberRoute(pathname))) {
    return;
  }
  const user = await getSessionUser();
  if (user === null || (administratorRoute && !user.admin)) {
    throw redirect({ to: '/' });
  }
};
