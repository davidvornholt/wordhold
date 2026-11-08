import { HttpApiMiddleware, HttpApiSecurity } from 'effect/http-api';
import type { CurrentMember } from './current-member';
import { Unauthorized } from './errors/api-errors';

/** Every endpoint needs the session token that `wordhold login` obtains through device authorization. */
export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  { provides: CurrentMember }
>()('@wordhold/api/Authorization', {
  requiredForClient: true,
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthorized,
}) {}
