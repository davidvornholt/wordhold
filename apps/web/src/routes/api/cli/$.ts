import { createFileRoute } from '@tanstack/react-router';
import { WordholdApi } from '@wordhold/api/api';
import { Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/http';
import { HttpApiBuilder } from 'effect/http-api';
import { coursesApi } from '../../../features/courses/api/courses-api';
import { entriesApi } from '../../../features/courses/api/entries-api';
import { overviewApi } from '../../../features/dashboard/api/overview-api';
import { accountApi } from '../../../shared/api/account-api';
import { apiAuthorization } from '../../../shared/api/api-authorization';
import { applyPrivateResponseHeaders } from '../../../shared/api/private-response';
import { getMember } from '../../../shared/auth/require-member';
import { authRuntime } from '../../../shared/auth/runtime';

type Handler = (request: Request) => Promise<Response>;

let built: Handler | undefined;

// Built on the first request, like the feature runtimes, so importing the
// route runs nothing.
const cliHandler = (): Handler => {
  if (built === undefined) {
    const groups = Layer.mergeAll(
      accountApi,
      coursesApi,
      entriesApi,
      overviewApi,
    ).pipe(
      Layer.provide(
        apiAuthorization((headers) =>
          authRuntime.runPromise(getMember(headers)),
        ),
      ),
    );
    const { handler } = HttpRouter.toWebHandler(
      HttpApiBuilder.layer(WordholdApi).pipe(
        Layer.provide(groups),
        Layer.provide(HttpServer.layerServices),
      ),
      { disableLogger: true },
    );
    built = (request) => handler(request);
  }
  return built;
};

/** The JSON API the `wordhold` CLI calls with the token from `wordhold login`. */
const serveCli = async ({ request }: { readonly request: Request }) => {
  const response = await cliHandler()(request);
  applyPrivateResponseHeaders(response.headers);
  return response;
};

export const Route = createFileRoute('/api/cli/$')({
  server: {
    handlers: { GET: serveCli, POST: serveCli, PATCH: serveCli },
  },
});
