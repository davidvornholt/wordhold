import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedOwner } from '../testing/owner-fixture';
import { MemberRepository, makeMemberRepository } from './member-repository';

const allowedGithubId = '123';
const administratorId = 'administrator';
const memberId = 'anna';

const runWithRepository = <A, E>(
  work: Effect.Effect<A, E, Database | MemberRepository>,
  getAllowedGithubId: () => string = () => allowedGithubId,
): Promise<A> =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return work.pipe(
        Effect.provide(
          makeMemberRepository(getAllowedGithubId).pipe(
            Layer.provide(databaseLayer),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedGithubAccount = (userId: string, githubId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* seedOwner(userId);
    yield* sql`insert into account (id, account_id, provider_id, user_id, updated_at)
      values (${userId}, ${githubId}, 'github', ${userId}, now())`;
  });

const seedMember = (options: {
  readonly enabled: boolean;
  readonly passkey: boolean;
}) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* seedOwner(memberId);
    yield* sql`insert into members (user_id, name, enabled)
      values (${memberId}, 'Anna', ${options.enabled})`;
    if (options.passkey) {
      yield* sql`insert into passkey (
          id, public_key, user_id, credential_id, counter, device_type, backed_up
        ) values (
          'passkey-anna', 'key', ${memberId}, 'credential-anna', 0,
          'singleDevice', false
        )`;
    }
  });

describe('MemberRepository administrator', () => {
  it('revokes the previous administrator on configuration changes while retaining their courses', async () => {
    let configuredGithubId = allowedGithubId;
    await runWithRepository(
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* MemberRepository;
        yield* seedGithubAccount(administratorId, allowedGithubId);
        yield* repository.ensureAdministrator;
        yield* sql`insert into courses (name, target_language, owner_id)
          values ('French', 'fr', ${administratorId})`;
        yield* sql`insert into session (id, expires_at, token, updated_at, user_id)
          values ('old-session', now() + interval '1 day', 'old-token', now(),
            ${administratorId})`;
        yield* sql`insert into passkey (
            id, public_key, user_id, credential_id, counter, device_type, backed_up
          ) values ('old-passkey', 'key', ${administratorId}, 'old-credential',
            0, 'singleDevice', false)`;

        configuredGithubId = '456';
        yield* repository.ensureAdministrator;
        const [session] = yield* sql<{ readonly userId: string }>`
          select user_id as "userId" from session where token = 'old-token'`;
        expect(session?.userId).toBe(administratorId);
        expect(
          yield* repository.authorize(session?.userId ?? ''),
        ).toBeUndefined();
        expect(yield* sql`select 1 from members where admin`).toHaveLength(0);

        yield* seedGithubAccount(memberId, configuredGithubId);
        yield* sql`insert into members (user_id, name, enabled)
          values (${memberId}, 'Anna', false)`;
        yield* Effect.all(
          [repository.ensureAdministrator, repository.ensureAdministrator],
          { concurrency: 2 },
        );

        expect(yield* repository.authorize(administratorId)).toBeUndefined();
        expect(yield* repository.authorize(memberId)).toEqual({
          userId: memberId,
          name: 'Anna',
          admin: true,
        });
        expect(
          yield* sql`select user_id as "userId" from members where admin`,
        ).toEqual([{ userId: memberId }]);
        expect(yield* sql`select owner_id as "ownerId" from courses`).toEqual([
          { ownerId: administratorId },
        ]);
        expect(
          yield* sql`select 1 from passkey where user_id = ${administratorId}`,
        ).toHaveLength(1);
      }),
      () => configuredGithubId,
    );
  });

  it('makes the allowlisted GitHub account the administrator of older courses', async () => {
    await runWithRepository(
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* MemberRepository;
        yield* seedGithubAccount(administratorId, allowedGithubId);
        yield* seedGithubAccount('someone-else', '456');
        yield* sql`insert into courses (name, target_language)
          values ('French', 'fr')`;

        yield* repository.ensureAdministrator;
        yield* repository.ensureAdministrator;

        expect(
          yield* sql`select user_id as "userId", admin from members`,
        ).toEqual([{ userId: administratorId, admin: true }]);
        expect(yield* sql`select owner_id as "ownerId" from courses`).toEqual([
          { ownerId: administratorId },
        ]);
        expect(yield* repository.authorize(administratorId)).toEqual({
          userId: administratorId,
          name: administratorId,
          admin: true,
        });
      }),
    );
  });
});

describe('MemberRepository sessions', () => {
  it('lets a registered person in and records when they were active', async () => {
    await runWithRepository(
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* MemberRepository;
        yield* seedMember({ enabled: true, passkey: true });

        expect(yield* repository.authorize(memberId)).toEqual({
          userId: memberId,
          name: 'Anna',
          admin: false,
        });
        const [member] = yield* sql<{ readonly lastActiveAt: Date | null }>`
          select last_active_at as "lastActiveAt" from members`;
        expect(member?.lastActiveAt).toBeInstanceOf(Date);
      }),
    );
  });

  it('turns away suspended people and those without a passkey', async () => {
    await runWithRepository(
      Effect.gen(function* () {
        const repository = yield* MemberRepository;
        yield* seedMember({ enabled: false, passkey: true });
        expect(yield* repository.authorize(memberId)).toBeUndefined();
        expect(yield* repository.authorize('unknown')).toBeUndefined();
      }),
    );
    await runWithRepository(
      Effect.gen(function* () {
        const repository = yield* MemberRepository;
        yield* seedMember({ enabled: true, passkey: false });
        expect(yield* repository.authorize(memberId)).toBeUndefined();
      }),
    );
  });

  it('revokes a session by its token', async () => {
    await runWithRepository(
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* MemberRepository;
        yield* seedMember({ enabled: true, passkey: true });
        yield* sql`insert into session (id, expires_at, token, updated_at, user_id)
          values ('session-anna', now() + interval '1 day', 'token-anna', now(),
            ${memberId})`;

        yield* repository.revokeSession('token-anna');

        expect(yield* sql`select 1 from session`).toHaveLength(0);
      }),
    );
  });
});
