// biome-ignore-all lint/suspicious/noMisplacedAssertion: This standalone integration executable uses assertions without a test runner.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDrizzle } from '@wordhold/db/drizzle';
import {
  migrateDatabase,
  migrationsFolder as migrationFolder,
} from '@wordhold/db/migrate';
import { stdout, write } from 'bun';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Effect } from 'effect';
import { serverEnv } from '../src/shared/env/server';

// This fixture never touches a normal development or production database.
const databaseUrl = new URL(serverEnv.databaseUrl());
if (
  !(
    databaseUrl.pathname.startsWith('/wordhold_test_') &&
    ['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
  )
) {
  throw new Error(
    'Use an empty local wordhold_test_* database for test:oauth.',
  );
}
const origin = serverEnv.publicUrl();
const allowedId = serverEnv.githubAllowedUserId();
const ok = 200;
const redirect = 302;
const database = makeDrizzle(databaseUrl.toString());
const pool = {
  query: async (text: string, parameters: Array<string> = []) => ({
    rows: await database.$client.unsafe(text, parameters),
  }),
  end: () => database.$client.end(),
};
const previousMigrations = await mkdtemp(
  join(tmpdir(), 'wordhold-oauth-migrations-'),
);
const originalFetch = globalThis.fetch;
const legacyUser = crypto.randomUUID();
const legacyEmail = `${legacyUser}@example.test`;
const token = 'fixture-github-access-token';
let profileId = allowedId;
let providerRequests = 0;
let appDatabase: ReturnType<typeof makeDrizzle> | undefined;
let disposeAuth: (() => Promise<void>) | undefined;
try {
  if (
    (
      await pool.query(
        // biome-ignore lint/security/noSecrets: SQL catalog query contains no credential.
        "select count(*)::int as count from information_schema.tables where table_schema='public'",
      )
    ).rows[0].count !== 0
  ) {
    throw new Error('The isolated wordhold_test_* database must be empty.');
  }
  // Upgrade the actual previous generated schema with a populated legacy account.
  const journal = JSON.parse(
    await readFile(join(migrationFolder, 'meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> };
  journal.entries = journal.entries.filter(
    ({ tag }) => tag !== '0020_lush_photon',
  );
  await mkdir(join(previousMigrations, 'meta'));
  await writeFile(
    join(previousMigrations, 'meta/_journal.json'),
    JSON.stringify(journal),
  );
  await Promise.all(
    journal.entries.map(async ({ tag }) => {
      await writeFile(
        join(previousMigrations, `${tag}.sql`),
        await readFile(join(migrationFolder, `${tag}.sql`)),
      );
    }),
  );
  await migrate(database, { migrationsFolder: previousMigrations });
  await pool.query('insert into "user" (id,name,email) values ($1,$2,$3)', [
    legacyUser,
    'Owner fixture',
    legacyEmail,
  ]);
  await pool.query(
    'insert into account (id,issuer,account_id,provider_id,user_id,access_token,updated_at) values ($1,$2,$3,$4,$5,$6,now())',
    [
      legacyUser,
      'https://github.com',
      allowedId,
      'github',
      legacyUser,
      'legacy-token',
    ],
  );
  // Duplicate provider identities must abort the whole generated migration,
  // preserving the previous required column, index and all account rows.
  const duplicateAccount = crypto.randomUUID();
  await pool.query(
    'insert into account (id,issuer,account_id,provider_id,user_id,updated_at) values ($1,$2,$3,$4,$5,now())',
    [duplicateAccount, 'legacy:other-issuer', allowedId, 'github', legacyUser],
  );
  await assert.rejects(() =>
    Effect.runPromise(migrateDatabase(databaseUrl.toString())),
  );
  assert.equal(
    (
      await pool.query(
        "select is_nullable from information_schema.columns where table_name='account' and column_name='issuer'",
      )
    ).rows[0].is_nullable,
    'NO',
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as count from pg_indexes where indexname='account_issuer_accountId_idx'",
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (await pool.query('select count(*)::int as count from account')).rows[0]
      .count,
    2,
  );
  await pool.query('delete from account where id=$1', [duplicateAccount]);
  await Effect.runPromise(migrateDatabase(databaseUrl.toString()));
  assert.equal(
    (await pool.query('select issuer from account where id=$1', [legacyUser]))
      .rows[0].issuer,
    'https://github.com',
  );

  // Only transport is mocked: Better Auth handles state, callbacks, the allowlist,
  // database writes and sessions using the production configuration.
  const providerResponse = (input: Parameters<typeof fetch>[0]): Response => {
    const url = String(input instanceof Request ? input.url : input);
    const email = profileId === allowedId ? legacyEmail : 'denied@example.test';
    providerRequests += 1;
    if (url === 'https://github.com/login/oauth/access_token') {
      return Response.json({
        // biome-ignore lint/style/useNamingConvention: GitHub OAuth wire field.
        access_token: token,
        // biome-ignore lint/style/useNamingConvention: GitHub OAuth wire field.
        token_type: 'bearer',
        scope: 'read:user,user:email',
      });
    }
    if (url === 'https://api.github.com/user') {
      return Response.json({
        id: Number(profileId),
        login: 'fixture-owner',
        name: 'Owner fixture',
        email,
        // biome-ignore lint/style/useNamingConvention: GitHub OAuth wire field.
        avatar_url: null,
      });
    }
    if (url === 'https://api.github.com/user/emails') {
      return Response.json([{ email, primary: true, verified: true }]);
    }
    throw new Error('Unexpected network request in isolated OAuth fixture.');
  };
  globalThis.fetch = Object.assign(
    (input: Parameters<typeof fetch>[0]) =>
      Promise.resolve(providerResponse(input)),
    { preconnect: originalFetch.preconnect },
  );
  const { auth } = await import('../src/shared/auth/server.ts');
  const handleAuth = auth.handler;
  appDatabase = (await import('../src/shared/db/server.ts')).db;
  const { authRuntime } = await import('../src/shared/auth/runtime.ts');
  disposeAuth = () => authRuntime.dispose();
  const anonymous = await handleAuth(
    new Request(`${origin}/api/auth/get-session`),
  );
  assert.equal(anonymous.status, ok);
  assert.equal(await anonymous.json(), null);
  const cookie = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  const start = async () => {
    const response = await handleAuth(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'github',
          callbackURL: '/',
          errorCallbackURL: '/login',
        }),
      }),
    );
    assert.equal(response.status, ok);
    const destination = new URL((await response.json()).url);
    assert.equal(destination.origin, 'https://github.com');
    return {
      state: destination.searchParams.get('state'),
      cookie: cookie(response),
    };
  };
  const callback = async (state: Awaited<ReturnType<typeof start>>) =>
    handleAuth(
      new Request(
        `${origin}/api/auth/callback/github?code=fixture-code&state=${encodeURIComponent(String(state.state))}`,
        { headers: { cookie: state.cookie } },
      ),
    );
  const login = async () => {
    const response = await callback(await start());
    assert.equal(response.status, redirect);
    assert.equal(
      new URL(String(response.headers.get('location')), origin).href,
      `${origin}/`,
    );
    const session = await handleAuth(
      new Request(`${origin}/api/auth/get-session`, {
        headers: { cookie: cookie(response) },
      }),
    );
    assert.equal(session.status, ok);
    return (await session.json()).user.id as string;
  };
  assert.equal(await login(), legacyUser);
  assert.equal(
    (
      await pool.query('select access_token from account where id=$1', [
        legacyUser,
      ])
    ).rows[0].access_token,
    token,
  );
  assert.equal(
    (await pool.query('select count(*)::int as count from account')).rows[0]
      .count,
    1,
  );
  profileId = '999999999';
  const denied = await callback(await start());
  // The existing profile mapper throws for another owner; no account or
  // session may be issued even when Better Auth reports that denial as 500.
  const deniedStatus = 500;
  assert.equal(denied.status, deniedStatus);
  assert.equal(
    denied.headers
      .getSetCookie()
      .some((value) => value.startsWith('better-auth.session_token=')),
    false,
  );
  assert.equal(
    (await pool.query('select count(*)::int as count from account')).rows[0]
      .count,
    1,
  );
  assert.equal(
    (await pool.query('select count(*)::int as count from "user"')).rows[0]
      .count,
    1,
  );
  // New allowed accounts insert without issuer; returning accounts retain it.
  await pool.query('delete from "user" where id=$1', [legacyUser]);
  profileId = allowedId;
  const newUser = await login();
  const [inserted] = (
    await pool.query(
      'select issuer,access_token from account where user_id=$1',
      [newUser],
    )
  ).rows;
  assert.equal(inserted.issuer, null);
  assert.equal(inserted.access_token, token);
  const requestsBeforeInvalidState = providerRequests;
  const invalid = await callback({ state: 'invalid-state', cookie: '' });
  assert.equal(invalid.status, redirect);
  assert.equal(providerRequests, requestsBeforeInvalidState);
  assert.equal(
    (await pool.query('select count(*)::int as count from account')).rows[0]
      .count,
    1,
  );
  await pool.query('delete from "user" where id=$1', [newUser]);
  await write(
    stdout,
    'PASS: generated migration preserves legacy identity; real OAuth callbacks reuse/create accounts, persist tokens, enforce allowlist/state, and create usable sessions.\n',
  );
} finally {
  globalThis.fetch = originalFetch;
  await appDatabase?.$client.end();
  await disposeAuth?.();
  await pool.end();
  await rm(previousMigrations, { recursive: true, force: true });
}
