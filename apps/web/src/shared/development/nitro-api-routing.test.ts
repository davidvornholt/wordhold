import { describe, expect, it } from 'bun:test';
import type { Connect } from 'vite';
import { isApiRequestPath, nitroApiRouting } from './nitro-api-routing';

const runMiddleware = (url: string, fetchDestination: string) => {
  const plugin = nitroApiRouting();
  let middleware: Connect.NextHandleFunction | undefined;
  const server = {
    middlewares: {
      use: (handler: Connect.NextHandleFunction) => {
        middleware = handler;
      },
    },
  };

  const { configureServer } = plugin;
  if (typeof configureServer !== 'function') {
    throw new Error('Expected the Nitro API routing plugin to configure Vite.');
  }
  configureServer.call(
    {} as ThisParameterType<typeof configureServer>,
    server as Parameters<typeof configureServer>[0],
  );
  if (middleware === undefined) {
    throw new Error(
      'Expected the Nitro API routing middleware to be registered.',
    );
  }

  const request = {
    headers: { 'sec-fetch-dest': fetchDestination },
    url,
  };
  let continued = false;
  middleware(
    request as Parameters<Connect.NextHandleFunction>[0],
    {} as Parameters<Connect.NextHandleFunction>[1],
    () => {
      continued = true;
    },
  );

  return { continued, fetchDestination: request.headers['sec-fetch-dest'] };
};

describe('nitroApiRouting', () => {
  it('routes browser image requests for TanStack Start APIs through Nitro', () => {
    expect(runMiddleware('/api/pages/page-id/image', 'image')).toEqual({
      continued: true,
      fetchDestination: 'document',
    });
  });

  it('leaves non-API image requests to Vite', () => {
    expect(runMiddleware('/assets/logo.png', 'image')).toEqual({
      continued: true,
      fetchDestination: 'image',
    });
  });

  it('leaves ordinary API fetch requests unchanged', () => {
    expect(runMiddleware('/api/pages', 'empty')).toEqual({
      continued: true,
      fetchDestination: 'empty',
    });
  });

  it('matches only the API path boundary', () => {
    expect(isApiRequestPath('/api')).toBe(true);
    expect(isApiRequestPath('/api/entries/entry-id/audio')).toBe(true);
    expect(isApiRequestPath('/apiary/logo.png')).toBe(false);
  });
});
