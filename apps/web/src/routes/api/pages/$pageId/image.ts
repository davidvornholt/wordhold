import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { NotOwnedError } from '../../../../shared/auth/ownership';
import { requireOwner } from '../../../../shared/auth/require-member';
import { serverRuntime } from '../../../../shared/runtime/server';
import { MediaNotFoundError } from '../../../../shared/storage/media-not-found-error';
import { privateMediaResponse } from '../../../../shared/storage/media-response';
import { loadPageImage } from '../../../../shared/storage/media-service';
import { mimeForPath } from '../../../../shared/storage/media-type';

const imageResponse = (request: Request, pageId: string) =>
  Effect.zipRight(
    requireOwner(request.headers, { pages: [pageId] }),
    loadPageImage(pageId),
  ).pipe(
    Effect.match({
      onFailure: (error) => {
        if (
          error instanceof MediaNotFoundError ||
          error instanceof NotOwnedError
        ) {
          return new Response(error.message, { status: 404 });
        }
        throw error;
      },
      onSuccess: ({ bytes, path }) =>
        privateMediaResponse(bytes, mimeForPath(path)),
    }),
  );

export const Route = createFileRoute('/api/pages/$pageId/image')({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        serverRuntime.runPromise(imageResponse(request, params.pageId)),
    },
  },
});
