import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import { serverEnv } from '../env/server';
import { AuthDatabaseError } from './auth-database-error';

// A person who may use Wordhold right now.
export type Member = {
  readonly userId: string;
  readonly name: string;
  readonly admin: boolean;
};

export type MemberRepositoryShape = {
  // Reconciles the configured administrator, revoking the previous one's access,
  // and claims courses created before accounts existed without moving owned ones.
  readonly ensureAdministrator: Effect.Effect<void, AuthDatabaseError>;
  // The member behind a session, or undefined when the person was suspended,
  // deleted, or has not finished registering a passkey.
  readonly authorize: (
    userId: string,
  ) => Effect.Effect<Member | undefined, AuthDatabaseError>;
  readonly revokeSession: (
    token: string,
  ) => Effect.Effect<void, AuthDatabaseError>;
};

export class MemberRepository extends Context.Service<
  MemberRepository,
  MemberRepositoryShape
>()('@wordhold/web/auth/MemberRepository') {}

const databaseFailure = (operation: string, cause: unknown) =>
  new AuthDatabaseError({
    operation,
    cause,
    message: `Authentication database operation failed: ${operation}.`,
  });

export const makeMemberRepository = (getAllowedGithubId: () => string) =>
  Layer.effect(
    MemberRepository,
    Effect.gen(function* () {
      const sql = yield* Database;
      return MemberRepository.of({
        ensureAdministrator: sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select pg_advisory_xact_lock(hashtextextended('wordhold:access', 0))`;
              const allowedGithubId = getAllowedGithubId();
              // Disable as well as demote: the previous administrator's passkeys
              // and sessions must not retain access after configuration changes.
              yield* sql`update members m set admin = false, enabled = false
              where m.admin and not exists (
                select 1 from account a where a.user_id = m.user_id
                  and a.provider_id = 'github' and a.account_id = ${allowedGithubId}
              )`;
              yield* sql`insert into members (user_id, name, admin)
              select u.id, u.name, true from "user" u
              join account a on a.user_id = u.id
              where a.provider_id = 'github' and a.account_id = ${allowedGithubId}
              on conflict (user_id) do update set admin = true, enabled = true`;
              yield* sql`update courses set owner_id = m.user_id from members m
              where m.admin and courses.owner_id is null`;
            }),
          )
          .pipe(
            Effect.mapError((cause) =>
              databaseFailure('ensure administrator', cause),
            ),
          ),
        authorize: (userId) =>
          sql<Member>`update members set last_active_at = now()
            where user_id = ${userId} and enabled
              and (admin or exists (select 1 from passkey where user_id = ${userId}))
            returning user_id as "userId", name, admin`.pipe(
            Effect.map((rows) => rows[0]),
            Effect.mapError((cause) =>
              databaseFailure('authorize member', cause),
            ),
          ),
        revokeSession: (token) =>
          sql`delete from session where token = ${token}`.pipe(
            Effect.asVoid,
            Effect.mapError((cause) =>
              databaseFailure('revoke session', cause),
            ),
          ),
      });
    }),
  );

export const MemberRepositoryLive = makeMemberRepository(
  serverEnv.githubAllowedUserId,
);
