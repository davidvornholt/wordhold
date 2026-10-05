import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { makeDrizzle } from '@wordhold/db/drizzle';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { seedOwner } from '../testing/owner-fixture';
import { consumeAccessCode, resolveAccessCode } from './access-codes';
import { codeDigest } from './code-secrets';

type CodeDatabase = ReturnType<typeof makeDrizzle>;

const memberId = 'anna';
const code = 'ABCD-EFGH-JKLM';
const invalidMessage =
  'Dieser Code ist ungültig oder abgelaufen. Bitte frag nach einem neuen.';

const runWithCodes = <A, E>(
  work: (codes: CodeDatabase) => Effect.Effect<A, E, Database>,
): Promise<A> =>
  Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.acquireRelease(
        Effect.sync(() => makeDrizzle(database.url)),
        (codes) => Effect.promise(() => codes.$client.end()),
      ).pipe(
        Effect.flatMap(work),
        Effect.scoped,
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );

const seedCode = (options: {
  readonly kind: 'invitation' | 'recovery';
  readonly enabled?: boolean;
  readonly admin?: boolean;
  readonly expired?: boolean;
}) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const digest = yield* Effect.promise(() => codeDigest(code));
    yield* seedOwner(memberId);
    yield* sql`insert into members (user_id, name, admin, enabled)
      values (${memberId}, 'Anna', ${options.admin ?? false},
        ${options.enabled ?? true})`;
    yield* sql`insert into access_codes (digest, user_id, kind, expires_at)
      values (${digest}, ${memberId}, ${options.kind}::access_code_kind,
        now() + ${options.expired === true ? sql`interval '-1 hour'` : sql`interval '1 hour'`})`;
  });

const seedDevice = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`insert into passkey (
      id, public_key, user_id, credential_id, counter, device_type, backed_up
    ) values (
      'old-passkey', 'key', ${memberId}, 'old-credential', 0, 'singleDevice', false
    )`;
  yield* sql`insert into session (id, expires_at, token, updated_at, user_id)
    values ('old-session', now() + interval '1 day', 'old-token', now(),
      ${memberId})`;
});

const rejection = (attempt: () => Promise<unknown>) =>
  Effect.tryPromise({ try: attempt, catch: (error) => error }).pipe(
    Effect.flip,
    Effect.map((error) => (error instanceof Error ? error.message : error)),
  );

const refusal = (options: Parameters<typeof seedCode>[0]) =>
  runWithCodes((codes) =>
    Effect.andThen(
      seedCode(options),
      rejection(() => resolveAccessCode(codes, code)),
    ),
  );

describe('resolveAccessCode', () => {
  it('finds the person a valid code belongs to', async () => {
    await runWithCodes((codes) =>
      Effect.gen(function* () {
        yield* seedCode({ kind: 'invitation' });

        expect(
          yield* Effect.promise(() => resolveAccessCode(codes, code)),
        ).toEqual({ id: memberId, name: 'Anna', displayName: 'Anna' });
        expect(yield* rejection(() => resolveAccessCode(codes, null))).toBe(
          invalidMessage,
        );
        expect(
          yield* rejection(() => resolveAccessCode(codes, 'WRONG-CODE')),
        ).toBe(invalidMessage);
      }),
    );
  });

  it('refuses expired codes and codes of suspended people or the administrator', async () => {
    const refused = [
      { kind: 'invitation', expired: true },
      { kind: 'invitation', enabled: false },
      { kind: 'recovery', admin: true },
    ] as const;
    expect(await Promise.all(refused.map(refusal))).toEqual(
      refused.map(() => invalidMessage),
    );
  });
});

describe('consumeAccessCode', () => {
  it('uses an invitation once and keeps existing devices', async () => {
    await runWithCodes((codes) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedCode({ kind: 'invitation' });
        yield* seedDevice;

        yield* Effect.promise(() => consumeAccessCode(codes, code, memberId));

        expect(yield* sql`select 1 from access_codes`).toHaveLength(0);
        expect(yield* sql`select 1 from passkey`).toHaveLength(1);
        expect(yield* sql`select 1 from session`).toHaveLength(1);
        expect(
          yield* rejection(() => consumeAccessCode(codes, code, memberId)),
        ).toBe(invalidMessage);
      }),
    );
  });

  it('replaces earlier passkeys and sessions with a recovery code', async () => {
    await runWithCodes((codes) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedCode({ kind: 'recovery' });
        yield* seedDevice;

        yield* Effect.promise(() => consumeAccessCode(codes, code, memberId));

        expect(yield* sql`select 1 from passkey`).toHaveLength(0);
        expect(yield* sql`select 1 from session`).toHaveLength(0);
      }),
    );
  });

  it('only redeems the code for the person it was issued to', async () => {
    await runWithCodes((codes) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedCode({ kind: 'recovery' });
        yield* seedDevice;

        expect(
          yield* rejection(() =>
            consumeAccessCode(codes, code, 'someone-else'),
          ),
        ).toBe(invalidMessage);
        expect(yield* sql`select 1 from access_codes`).toHaveLength(1);
        expect(yield* sql`select 1 from passkey`).toHaveLength(1);
      }),
    );
  });
});
