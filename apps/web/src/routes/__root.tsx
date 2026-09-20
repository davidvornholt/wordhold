import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useMatches,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { getSessionUser } from '../shared/auth/session-fn';
import { documentLanguage } from '../shared/routing/document-language';
import {
  RootError,
  RootNotFound,
  RootPending,
} from '../shared/routing/root-feedback';
import { redirectExpiredOwnerRoute } from '../shared/routing/root-guard';
import { usesFocusShell } from '../shared/routing/shell';
import { AppShell } from '../shared/ui/app-shell';
import { wordmarkClass } from '../shared/ui/shell-styles';
import appCss from '../styles.css?url';

type RootDocumentProps = {
  readonly children: ReactNode;
};

const RootDocument = ({ children }: RootDocumentProps) => (
  <html lang={documentLanguage}>
    <head>
      <HeadContent />
    </head>
    <body>
      {children}
      <Scripts />
    </body>
  </html>
);

const RootLayout = () => {
  const matches = useMatches();
  if (usesFocusShell(matches)) {
    return <Outlet />;
  }
  return (
    <AppShell
      home={
        <Link className={wordmarkClass} to="/">
          Wordhold
        </Link>
      }
    >
      <Outlet />
    </AppShell>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Wordhold' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: ({ location }) =>
    redirectExpiredOwnerRoute(location.pathname, getSessionUser),
  shellComponent: RootDocument,
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
  pendingComponent: RootPending,
});
