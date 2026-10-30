import { AuthenticationError } from '../auth/authentication-error';
import { NotOwnedError } from '../auth/ownership';
import { MediaNotFoundError } from './media-not-found-error';

const unauthorizedStatus = 401;
const notFoundStatus = 404;

export const privateMediaResponse = (
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Response =>
  new Response(bytes, {
    headers: {
      'cache-control': 'private, no-store',
      'content-type': contentType,
    },
  });

// A request without a session is told to sign in. Someone else's medium is
// reported like a missing one. Any other failure stays a server error.
export const mediaErrorResponse = (error: unknown): Response => {
  if (error instanceof AuthenticationError) {
    return new Response(error.message, { status: unauthorizedStatus });
  }
  if (error instanceof MediaNotFoundError || error instanceof NotOwnedError) {
    return new Response(error.message, { status: notFoundStatus });
  }
  throw error;
};
