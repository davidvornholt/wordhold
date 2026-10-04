import { createFileRoute } from '@tanstack/react-router';
import { SttError } from '@wordhold/ai/stt/error';
import { Effect } from 'effect';
import {
  dictationRuntime,
  readDictation,
  transcribeDictation,
} from '../../features/practice/services/dictation';
import { AuthenticationError } from '../../shared/auth/authentication-error';
import { requireMember } from '../../shared/auth/require-member';
import { RequestBodyError } from '../../shared/http/bounded-body';

const unauthorizedStatus = 401;
const badGatewayStatus = 502;

// A finished recording arrives as the request body and comes back as text.
// Nothing of it is stored.
const dictationResponse = (request: Request) =>
  Effect.gen(function* () {
    // Checked before the body is read, so a stranger's recording is not read.
    const member = yield* requireMember(request.headers);
    const audio = yield* readDictation(request);
    return yield* transcribeDictation(member.userId, audio);
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
        if (error instanceof SttError) {
          return Response.json(
            { error: error.message },
            { status: badGatewayStatus },
          );
        }
        throw error;
      },
      onSuccess: (transcript) => Response.json({ transcript }),
    }),
  );

export const Route = createFileRoute('/api/dictations')({
  server: {
    handlers: {
      POST: ({ request }) =>
        dictationRuntime.runPromise(dictationResponse(request)),
    },
  },
});
