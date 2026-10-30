import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { requireOwner } from '../../../../shared/auth/require-member';
import { serverRuntime } from '../../../../shared/runtime/server';
import {
  mediaErrorResponse,
  privateMediaResponse,
} from '../../../../shared/storage/media-response';
import { loadExampleAudio } from '../../../../shared/storage/media-service';

const audioResponse = (request: Request, entryId: string) =>
  Effect.andThen(
    requireOwner(request.headers, { entries: [entryId] }),
    loadExampleAudio(entryId),
  ).pipe(
    Effect.match({
      onFailure: mediaErrorResponse,
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
