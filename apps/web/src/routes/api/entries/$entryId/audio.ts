import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { NotOwnedError } from '../../../../shared/auth/ownership';
import { requireOwner } from '../../../../shared/auth/require-member';
import { serverRuntime } from '../../../../shared/runtime/server';
import { MediaNotFoundError } from '../../../../shared/storage/media-not-found-error';
import { privateMediaResponse } from '../../../../shared/storage/media-response';
import { loadEntryAudio } from '../../../../shared/storage/media-service';

const audioResponse = (request: Request, entryId: string) =>
  Effect.andThen(
    requireOwner(request.headers, { entries: [entryId] }),
    loadEntryAudio(entryId),
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
      onSuccess: ({ bytes }) => privateMediaResponse(bytes, 'audio/mpeg'),
    }),
  );

export const Route = createFileRoute('/api/entries/$entryId/audio')({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        serverRuntime.runPromise(audioResponse(request, params.entryId)),
    },
  },
});
