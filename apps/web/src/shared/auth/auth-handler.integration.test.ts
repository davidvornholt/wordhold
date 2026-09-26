import { expect, it } from 'bun:test';
import process from 'node:process';
import { withTestDatabase } from '@wordhold/db/testing/postgres-test-database';
import { spawn } from 'bun';
import { Effect } from 'effect';

const integrationTimeoutMs = 30_000;

it(
  'upgrades legacy accounts and serves real GitHub callbacks and sessions',
  async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.tryPromise(async () => {
          // Separate process keeps the provider transport fixture and production
          // auth singleton out of other tests' global fetch/environment state.
          const child = spawn([process.execPath, 'scripts/oauth-check.ts'], {
            cwd: `${import.meta.dir}/../../..`,
            env: {
              NODE_ENV: 'test',
              DATABASE_URL: database.url,
              WORDHOLD_PUBLIC_URL: 'http://localhost:3199',
              AUTH_SECRET: 'public-auth-fixture-secret-32-characters',
              GITHUB_CLIENT_ID: 'fixture-client',
              GITHUB_CLIENT_SECRET: 'fixture-client-secret',
              GITHUB_ALLOWED_USER_ID: '123',
            },
            stdout: 'pipe',
            stderr: 'pipe',
          });
          const [stdout, stderr, exit] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
          ]);
          expect({
            exit,
            diagnostics: exit === 0 ? '' : stdout + stderr,
          }).toEqual({
            exit: 0,
            diagnostics: '',
          });
        }),
      ),
    );
  },
  integrationTimeoutMs,
);
