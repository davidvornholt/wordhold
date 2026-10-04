import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { codeDigest } from '../../../shared/auth/code-secrets';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureOwnerId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { seedOwner } from '../../../shared/testing/owner-fixture';
import { PeopleStore } from './people-store';

const administratorId = 'administrator';

const runWithStore = <A, E>(
  work: Effect.Effect<A, E, Database | PeopleStore>,
): Promise<A> =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return work.pipe(
        Effect.provide(PeopleStore.live.pipe(Layer.provide(databaseLayer))),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedMember = (userId: string, options: { readonly admin?: boolean }) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* seedOwner(userId);
    yield* sql`insert into members (user_id, name, admin)
      values (${userId}, ${userId}, ${options.admin ?? false})`;
  });

const seedPasskey = (userId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* sql`insert into passkey (
        id, public_key, user_id, credential_id, counter, device_type, backed_up
      ) values (
        ${`passkey-${userId}`}, 'key', ${userId}, ${`credential-${userId}`},
        0, 'singleDevice', false
      )`;
  });

const seedSession = (userId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* sql`insert into session (id, expires_at, token, updated_at, user_id)
      values (${`session-${userId}`}, now() + interval '1 day',
        ${`token-${userId}`}, now(), ${userId})`;
  });

const failureTag = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );

describe('PeopleStore invitations', () => {
  it('creates the account, the member and a stored digest of the code', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PeopleStore;
        const issued = yield* store.invite('Jürgen Weiß');

        expect(issued.kind).toBe('invitation');
        expect(issued.name).toBe('Jürgen Weiß');
        expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
        const [user] = yield* sql<{ readonly email: string }>`
          select email from "user" where id = ${issued.userId}`;
        expect(user?.email).toStartWith('juergen-weiss.');
        const [code] = yield* sql<{ readonly digest: string }>`
          select digest from access_codes where user_id = ${issued.userId}`;
        expect(code?.digest).toBe(
          yield* Effect.promise(() => codeDigest(issued.code)),
        );

        const person = yield* store.get(issued.userId);
        expect(person).toMatchObject({
          name: 'Jürgen Weiß',
          admin: false,
          enabled: true,
          registered: false,
          code: { kind: 'invitation' },
          lastActiveAt: null,
        });
      }),
    );
  });

  it('issues a recovery code once a passkey exists and replaces the earlier code', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PeopleStore;
        const invited = yield* store.invite('Anna');
        const renewed = yield* store.issueCode(invited.userId);
        expect(renewed.kind).toBe('invitation');

        yield* seedPasskey(invited.userId);
        const recovery = yield* store.issueCode(invited.userId);
        expect(recovery.kind).toBe('recovery');
        const codes = yield* sql<{ readonly kind: string }>`
          select kind from access_codes where user_id = ${invited.userId}`;
        expect(codes).toEqual([{ kind: 'recovery' }]);

        yield* store.withdrawCode(invited.userId);
        expect((yield* store.get(invited.userId)).code).toBeNull();
      }),
    );
  });

  it('gives no code to a suspended person or the administrator', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const store = yield* PeopleStore;
        yield* seedMember(administratorId, { admin: true });
        const invited = yield* store.invite('Ben');
        yield* store.setEnabled(invited.userId, false);

        expect(yield* failureTag(store.issueCode(invited.userId))).toBe(
          'PersonSuspendedError',
        );
        expect(yield* failureTag(store.issueCode(administratorId))).toBe(
          'PersonNotFoundError',
        );
      }),
    );
  });
});

describe('PeopleStore access', () => {
  it('signs a suspended person out and withdraws their code', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PeopleStore;
        const invited = yield* store.invite('Clara');
        yield* seedSession(invited.userId);

        yield* store.setEnabled(invited.userId, false);
        const sessions = yield* sql`
          select 1 from session where user_id = ${invited.userId}`;
        expect(sessions).toHaveLength(0);
        expect(yield* store.get(invited.userId)).toMatchObject({
          enabled: false,
          code: null,
        });

        yield* store.setEnabled(invited.userId, true);
        expect((yield* store.get(invited.userId)).enabled).toBe(true);
      }),
    );
  });

  it('never changes or deletes the administrator', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const store = yield* PeopleStore;
        yield* seedMember(administratorId, { admin: true });

        expect(
          yield* failureTag(store.setEnabled(administratorId, false)),
        ).toBe('PersonNotFoundError');
        expect(yield* failureTag(store.remove(administratorId))).toBe(
          'PersonNotFoundError',
        );
        expect(yield* store.get(administratorId)).toMatchObject({
          admin: true,
          enabled: true,
          registered: true,
        });
      }),
    );
  });

  it('lists the administrator first', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const store = yield* PeopleStore;
        yield* store.invite('Anna');
        yield* seedMember(administratorId, { admin: true });

        expect((yield* store.list).map((person) => person.name)).toEqual([
          administratorId,
          'Anna',
        ]);
      }),
    );
  });
});

describe('PeopleStore deletion', () => {
  it('deletes the person with their courses and returns their stored files', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PeopleStore;
        yield* seedIntroducedCardFixture;
        yield* sql`insert into members (user_id, name)
          values (${fixtureOwnerId}, 'Anna')`;
        yield* sql`insert into pages (course_id, image_path)
          values (${fixtureCourseId}, 'pages/anna.jpg')`;
        yield* sql`insert into entry_audio (entry_id, voice, path)
          values (${dueEntryId}, 'Lea', 'audio/anna.mp3')`;
        yield* sql`insert into ai_usage (user_id, operation, provider, model)
          values (${fixtureOwnerId}, 'speech', 'polly', 'neural')`;

        const files = yield* store.remove(fixtureOwnerId);

        expect([...files].sort()).toEqual(['audio/anna.mp3', 'pages/anna.jpg']);
        const [left] = yield* sql<{
          readonly users: number;
          readonly courses: number;
          readonly entries: number;
          readonly usage: number;
        }>`
          select
            (select count(*)::int from "user" where id = ${fixtureOwnerId}) as users,
            (select count(*)::int from courses where id = ${fixtureCourseId}) as courses,
            (select count(*)::int from entries) as entries,
            (select count(*)::int from ai_usage where user_id is null) as usage
        `;
        expect(left).toEqual({ users: 0, courses: 0, entries: 0, usage: 1 });
      }),
    );
  });
});

describe('PeopleStore usage', () => {
  it('sums requests per person and keeps those of deleted accounts', async () => {
    await runWithStore(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* PeopleStore;
        const anna = yield* store.invite('Anna');
        yield* sql`insert into ai_usage
            (user_id, operation, provider, model, status, estimated_usd, created_at)
          values
            (${anna.userId}, 'speech', 'polly', 'neural', 'succeeded', 0.25, now()),
            (${anna.userId}, 'speech', 'polly', 'neural', 'failed', null, now()),
            (null, 'speech', 'polly', 'neural', 'succeeded', 0.5, now()),
            (${anna.userId}, 'speech', 'polly', 'neural', 'succeeded', 9, now() - interval '40 days')`;

        expect(yield* store.usage(30)).toEqual([
          {
            userId: anna.userId,
            name: 'Anna',
            operation: 'speech',
            provider: 'polly',
            model: 'neural',
            requests: 2,
            failed: 1,
            unknownCost: 1,
            estimatedUsd: 0.25,
          },
          {
            userId: null,
            name: null,
            operation: 'speech',
            provider: 'polly',
            model: 'neural',
            requests: 1,
            failed: 0,
            unknownCost: 0,
            estimatedUsd: 0.5,
          },
        ]);
      }),
    );
  });
});
