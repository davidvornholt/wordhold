import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import {
  BibleConflictError,
  BibleModuleError,
} from '../../features/bibles/errors/bible-errors';
import { bibleRuntime } from '../../features/bibles/runtime';
import { BibleService } from '../../features/bibles/services/bible-service';
import { readModuleUpload } from '../../features/bibles/services/upload';
import { AuthenticationError } from '../../shared/auth/authentication-error';
import { requireMember } from '../../shared/auth/require-member';
import { RequestBodyError } from '../../shared/http/bounded-body';

const unauthorizedStatus = 401;
const badRequestStatus = 400;
const conflictStatus = 409;

// A Bible module arrives as the request body, since it is one file and
// nothing else. Its verses are stored for the uploader only.
const uploadResponse = (request: Request) =>
  Effect.gen(function* () {
    // Checked before the body is read, so a stranger's upload is not read.
    const member = yield* requireMember(request.headers);
    const bytes = yield* readModuleUpload(request);
    const service = yield* BibleService;
    return yield* service.importModule(member.userId, bytes);
  }).pipe(
    Effect.match({
      onFailure: (error) => {
        if (error instanceof AuthenticationError) {
          return Response.json(
            { error: error.message },
            { status: unauthorizedStatus },
          );
        }
        if (error instanceof RequestBodyError) {
          return Response.json(
            { error: error.message },
            { status: error.status },
          );
        }
        if (error instanceof BibleModuleError) {
          return Response.json(
            { error: error.message },
            { status: badRequestStatus },
          );
        }
        if (error instanceof BibleConflictError) {
          return Response.json(
            { error: error.message },
            { status: conflictStatus },
          );
        }
        throw error;
      },
      onSuccess: (bible) => Response.json(bible),
    }),
  );

export const Route = createFileRoute('/api/bibles')({
  server: {
    handlers: {
      POST: ({ request }) => bibleRuntime.runPromise(uploadResponse(request)),
    },
  },
});
