import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { requireSession } from '../../../../shared/auth/require-session';
import { serverRuntime } from '../../../../shared/runtime/server';
import { MediaNotFoundError } from '../../../../shared/storage/media-not-found-error';
import { privateMediaResponse } from '../../../../shared/storage/media-response';
import { loadExampleAudio } from '../../../../shared/storage/media-service';

const audioResponse = (request: Request, entryId: string) =>
  Effect.zipRight(
    requireSession(request.headers),
    loadExampleAudio(entryId),
  ).pipe(
    Effect.match({
      onFailure: (error) => {
        if (error instanceof MediaNotFoundError) {
          return new Response(error.message, { status: 404 });
        }
        throw error;
      },
      onSuccess: ({ bytes }) => privateMediaResponse(bytes, 'audio/mpeg'),
    }),
  );

export const Route = createFileRoute('/api/entries/$entryId/example-audio')({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        serverRuntime.runPromise(audioResponse(request, params.entryId)),
    },
  },
});
