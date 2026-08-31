import type { Plugin } from 'vite';

const apiPath = '/api';
const browserNavigationDestination = /^(?:document|iframe|frame)$/u;
const serverFetchDestination = 'document';

export const isApiRequestPath = (url: string | undefined): boolean =>
  url === apiPath || url?.startsWith(`${apiPath}/`) === true;

const isBrowserAssetDestination = (
  fetchDestination: string | ReadonlyArray<string> | undefined,
): boolean =>
  typeof fetchDestination === 'string' &&
  fetchDestination !== 'empty' &&
  !browserNavigationDestination.test(fetchDestination);

export const nitroApiRouting = (): Plugin => ({
  name: 'wordhold:nitro-api-routing',
  enforce: 'pre',
  configureServer: (server) => {
    server.middlewares.use((request, _response, next) => {
      if (
        isApiRequestPath(request.url) &&
        isBrowserAssetDestination(request.headers['sec-fetch-dest'])
      ) {
        // Nitro otherwise mistakes browser-tagged TanStack Start API requests
        // for static assets and skips the application handler in development.
        request.headers['sec-fetch-dest'] = serverFetchDestination;
      }
      next();
    });
  },
});
