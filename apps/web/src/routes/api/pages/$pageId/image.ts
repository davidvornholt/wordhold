import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { requireSession } from '../../../../shared/auth/require-session';
import { serverRuntime } from '../../../../shared/runtime/server';
import { MediaNotFoundError } from '../../../../shared/storage/media-not-found-error';
import { privateMediaResponse } from '../../../../shared/storage/media-response';
import { loadPageImage } from '../../../../shared/storage/media-service';
import { mimeForPath } from '../../../../shared/storage/media-type';

const imageResponse = (request: Request, pageId: string) =>
  Effect.zipRight(requireSession(request.headers), loadPageImage(pageId)).pipe(
    Effect.match({
      onFailure: (error) => {
        if (error instanceof MediaNotFoundError) {
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
