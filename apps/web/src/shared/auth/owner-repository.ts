import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { serverEnv } from '../env/server';
import { AuthDatabaseError } from './auth-database-error';

export type OwnerRepositoryShape = {
  readonly isAllowedUser: (
    userId: string,
  ) => Effect.Effect<boolean, AuthDatabaseError>;
  readonly revokeSession: (
    token: string,
  ) => Effect.Effect<void, AuthDatabaseError>;
};

export class OwnerRepository extends Context.Tag(
  '@wordhold/web/auth/OwnerRepository',
)<OwnerRepository, OwnerRepositoryShape>() {}

const databaseFailure = (operation: string, cause: unknown) =>
  new AuthDatabaseError({
    operation,
    cause,
    message: `Authentication database operation failed: ${operation}.`,
  });

export const OwnerRepositoryLive = Layer.effect(
  OwnerRepository,
  Effect.gen(function* () {
    const sql = yield* Database;
    return OwnerRepository.of({
      isAllowedUser: (userId) =>
        sql<{
          accountId: string;
        }>`select account_id as "accountId" from account where user_id = ${userId} and provider_id = 'github' and account_id = ${serverEnv.githubAllowedUserId()} limit 1`.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError((cause) =>
            databaseFailure('check allowed owner', cause),
          ),
        ),
      revokeSession: (token) =>
        sql`delete from session where token = ${token}`.pipe(
          Effect.asVoid,
          Effect.mapError((cause) => databaseFailure('revoke session', cause)),
        ),
    });
  }),
);
