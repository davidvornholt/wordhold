import { WordholdApi } from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';

export const accountApi = HttpApiBuilder.group(
  WordholdApi,
  'account',
  (handlers) =>
    Effect.succeed(
      handlers.handle('me', () =>
        Effect.map(CurrentMember, (member) => ({
          name: member.name,
          admin: member.admin,
        })),
      ),
    ),
);
