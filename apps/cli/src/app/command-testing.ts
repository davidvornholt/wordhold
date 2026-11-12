import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { BunServices } from '@effect/platform-bun';
import { ConfigProvider, Effect, FileSystem } from 'effect';
import { Command } from 'effect/cli';
import { FetchHttpClient } from 'effect/http';
import { logout, status } from './account-commands';
import { courses } from './course-commands';
import { entries } from './entry-commands';
import { exams } from './exam-commands';
import { progress } from './progress-command';
import { root } from './root';

export const origin = 'https://wordhold.example.com';
export const token = 'session-token';
export const course = '7d1c2a57-4b8e-4c43-9a43-2f5e8c6f0a11';
export const unit = '0b6a4f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
export const entryId = '5f0e9d8c-7b6a-4c5d-8e9f-0a1b2c3d4e5f';

type Sent = {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

type FakeServer = {
  sent: Array<Sent>;
  answer: (path: string) => Response;
  fileSystem: (real: FileSystem.FileSystem) => FileSystem.FileSystem;
  // The temporary home the commands keep their session and cache in.
  home: string;
};

// Stands in for the Wordhold server: records each request and answers it with
// `answer`, so no test reaches a real server.
export const server: FakeServer = {
  sent: [],
  answer: () => Response.json({}),
  fileSystem: (real) => real,
  home: '',
};

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const text = await request.text();
  server.sent.push({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    authorization: request.headers.get('authorization'),
    body: text === '' ? undefined : JSON.parse(text),
  });
  return server.answer(`${url.pathname}${url.search}`);
}) as typeof globalThis.fetch;

const wordhold = root.pipe(
  Command.withSubcommands([logout, status, courses, entries, exams, progress]),
);

let printedLines: Array<string> = [];
let realWrite: typeof process.stdout.write | undefined;

/**
 * Signs in to the fake server, which answers with `answer`, and holds back
 * what the commands print. Call it before each test and `stopFakeServer`
 * after.
 */
export const startFakeServer = async (answer: (path: string) => Response) => {
  server.sent = [];
  server.answer = answer;
  server.fileSystem = (real) => real;
  server.home = await mkdtemp(join(tmpdir(), 'wordhold-cli-'));
  await Bun.write(
    join(server.home, 'config', 'wordhold', 'sessions.json'),
    JSON.stringify({ [origin]: { token } }),
  );
  printedLines = [];
  realWrite = process.stdout.write;
  // The stream's overloads allow no narrower function, and every caller here
  // passes text.
  process.stdout.write = ((chunk: unknown) => {
    printedLines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
};

export const stopFakeServer = async () => {
  if (realWrite !== undefined) {
    process.stdout.write = realWrite;
  }
  await rm(server.home, { recursive: true, force: true });
};

export const printed = () => JSON.parse(printedLines.at(-1) ?? 'null');

const run = (...args: ReadonlyArray<string>) =>
  Effect.runPromise(
    Command.runWith(wordhold, { version: 'test' })(args).pipe(
      Effect.updateService(FileSystem.FileSystem, (real) =>
        server.fileSystem(real),
      ),
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            [
              `WORDHOLD_SERVER=${origin}`,
              `XDG_CONFIG_HOME=${join(server.home, 'config')}`,
              `XDG_CACHE_HOME=${join(server.home, 'cache')}`,
            ].join('\n'),
          ),
        ),
      ),
      Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
      Effect.result,
    ),
  );

export const runOk = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Failure') {
    throw new Error(`wordhold ${args.join(' ')} failed: ${result.failure}`);
  }
};

export const failureOf = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Success') {
    throw new Error(`wordhold ${args.join(' ')} succeeded`);
  }
  return result.failure;
};
