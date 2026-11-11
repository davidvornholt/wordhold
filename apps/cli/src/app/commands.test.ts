import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { BunServices } from '@effect/platform-bun';
import { signOutPath } from '@wordhold/api/device-login';
import type { SavedEntry } from '@wordhold/api/vocabulary';
import { ConfigProvider, Effect, FileSystem, PlatformError } from 'effect';
import { Command } from 'effect/cli';
import { FetchHttpClient } from 'effect/http';
import { logout, status } from './account-commands';
import { courses } from './course-commands';
import { entries } from './entry-commands';
import { progress } from './progress-command';
import { root } from './root';

const origin = 'https://wordhold.example.com';
const token = 'session-token';
const course = '7d1c2a57-4b8e-4c43-9a43-2f5e8c6f0a11';
const unit = '0b6a4f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const entryId = '5f0e9d8c-7b6a-4c5d-8e9f-0a1b2c3d4e5f';

const saved: SavedEntry = {
  entry: {
    id: entryId,
    course: { id: course, name: 'Spanisch', kind: 'language' },
    book: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', name: 'Buch 1' },
    unit: { id: unit, name: 'Lektion 1' },
    targetText: 'la mesa',
    nativeText: 'der Tisch',
    example: {
      targetText: 'La mesa es grande.',
      nativeText: 'Der Tisch ist groß.',
      source: 'textbook',
    },
    synonyms: null,
    antonyms: null,
    keyPoints: null,
    introduced: false,
    cards: [],
  },
  audio: 'generated',
};

type Sent = {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

// Stands in for the Wordhold server: records each request and answers it with
// `answer`, so no test reaches a real server.
let sent: Array<Sent> = [];
let answer: (path: string) => Response = () => Response.json({});
let fileSystem = (real: FileSystem.FileSystem) => real;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const text = await request.text();
  sent.push({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    authorization: request.headers.get('authorization'),
    body: text === '' ? undefined : JSON.parse(text),
  });
  return answer(`${url.pathname}${url.search}`);
}) as typeof globalThis.fetch;

const wordhold = root.pipe(
  Command.withSubcommands([logout, status, courses, entries, progress]),
);

let home = '';
let stdout: ReturnType<typeof spyOn>;

const printed = () =>
  JSON.parse(String(stdout.mock.calls.at(-1)?.[0] ?? 'null'));

const run = (...args: ReadonlyArray<string>) =>
  Effect.runPromise(
    Command.runWith(wordhold, { version: 'test' })(args).pipe(
      Effect.updateService(FileSystem.FileSystem, (real) => fileSystem(real)),
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            [
              `WORDHOLD_SERVER=${origin}`,
              `XDG_CONFIG_HOME=${join(home, 'config')}`,
              `XDG_CACHE_HOME=${join(home, 'cache')}`,
            ].join('\n'),
          ),
        ),
      ),
      Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
      Effect.result,
    ),
  );

const runOk = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Failure') {
    throw new Error(`wordhold ${args.join(' ')} failed: ${result.failure}`);
  }
};

const failureOf = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Success') {
    throw new Error(`wordhold ${args.join(' ')} succeeded`);
  }
  return result.failure;
};

beforeEach(async () => {
  sent = [];
  answer = () => Response.json(saved);
  fileSystem = (real) => real;
  home = await mkdtemp(join(tmpdir(), 'wordhold-cli-'));
  await Bun.write(
    join(home, 'config', 'wordhold', 'sessions.json'),
    JSON.stringify({ [origin]: { token } }),
  );
  stdout = spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  stdout.mockRestore();
  await rm(home, { recursive: true, force: true });
});

describe('wordhold entries add', () => {
  it('adds a trimmed word with its example to a unit', async () => {
    await runOk(
      'entries',
      'add',
      course,
      '--target',
      ' la mesa ',
      '--native',
      'der Tisch',
      '--unit',
      unit,
      '--example',
      'La mesa es grande.',
      '--example-translation',
      'Der Tisch ist groß.',
    );
    expect(sent).toEqual([
      {
        method: 'POST',
        path: `/api/cli/courses/${course}/entries`,
        authorization: `Bearer ${token}`,
        body: {
          targetText: 'la mesa',
          nativeText: 'der Tisch',
          unitId: unit,
          example: {
            targetText: 'La mesa es grande.',
            nativeText: 'Der Tisch ist groß.',
          },
        },
      },
    ]);
    expect(printed()).toEqual(saved);
  });

  it('leaves the place to the server when none is given', async () => {
    await runOk('entries', 'add', course, '--target', 'el', '--native', 'der');
    expect(sent[0]?.body).toEqual({ targetText: 'el', nativeText: 'der' });
  });

  it('rejects a translation without an example before reading the session', async () => {
    await rm(join(home, 'config'), { recursive: true });
    const failure = await failureOf(
      'entries',
      'add',
      course,
      '--target',
      'la mesa',
      '--native',
      'der Tisch',
      '--example-translation',
      'Der Tisch ist groß.',
    );
    expect(failure._tag).toBe('InvalidInput');
    expect(sent).toEqual([]);
  });

  it('rejects an empty word', async () => {
    const failure = await failureOf(
      'entries',
      'add',
      course,
      '--target',
      '  ',
      '--native',
      'der Tisch',
    );
    expect(failure._tag).toBe('InvalidInput');
    expect(sent).toEqual([]);
  });
});

describe('wordhold entries edit', () => {
  it('sends only the fields that change', async () => {
    await runOk('entries', 'edit', entryId, '--native', 'der Esstisch');
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: `/api/cli/entries/${entryId}`,
        authorization: `Bearer ${token}`,
        body: { nativeText: 'der Esstisch' },
      },
    ]);
  });

  it('removes the example with --no-example', async () => {
    await runOk('entries', 'edit', entryId, '--no-example');
    expect(sent[0]?.body).toEqual({ example: null });
  });

  it('replaces the synonyms with the trimmed words given, one per flag', async () => {
    await runOk(
      'entries',
      'edit',
      entryId,
      '--synonym',
      ' el escritorio ',
      '--synonym',
      'la mesa, la tabla',
    );
    expect(sent[0]?.body).toEqual({
      synonyms: ['el escritorio', 'la mesa, la tabla'],
    });
  });

  it('removes the antonyms with --no-antonyms and keeps the synonyms', async () => {
    await runOk('entries', 'edit', entryId, '--no-antonyms');
    expect(sent[0]?.body).toEqual({ antonyms: [] });
  });

  it.each([
    [[]],
    [['--no-example', '--example', 'La mesa es grande.']],
    [['--no-synonyms', '--synonym', 'el escritorio']],
    [['--antonym', ' ']],
  ])('refuses %j before asking the server', async (flags) => {
    const failure = await failureOf('entries', 'edit', entryId, ...flags);
    expect(failure._tag).toBe('InvalidInput');
    expect(sent).toEqual([]);
  });
});

describe('wordhold entries list and search', () => {
  it('passes the filter and unit as query parameters', async () => {
    answer = () => Response.json([saved.entry]);
    await runOk('entries', 'list', course, '--filter', 'due', '--unit', unit);
    expect(sent[0]?.path).toBe(
      `/api/cli/courses/${course}/entries?filter=due&unit=${unit}`,
    );
    expect(printed()).toEqual([saved.entry]);
  });

  it('searches one course for a trimmed text', async () => {
    answer = () => Response.json([saved.entry]);
    await runOk('entries', 'search', ' mesa ', '--course', course);
    expect(sent[0]?.path).toBe(`/api/cli/entries?query=mesa&course=${course}`);
  });
});

describe('wordhold courses get', () => {
  it('rejects a course id before reading the session or asking the server', async () => {
    await rm(join(home, 'config'), { recursive: true });
    const failure = await failureOf('courses', 'get', 'spanisch');
    expect(failure._tag).toBe('InvalidInput');
    expect(sent).toEqual([]);
  });

  it('asks to sign in again when the server refuses the session', async () => {
    answer = () =>
      Response.json(
        { _tag: 'Unauthorized', message: 'Not signed in.' },
        { status: 401 },
      );
    const failure = await failureOf('courses', 'get', course);
    expect(failure._tag).toBe('NotSignedIn');
    expect(failure.message).toContain('wordhold login');
  });

  it('passes on what Wordhold rejects', async () => {
    answer = () =>
      Response.json(
        { _tag: 'NotFound', message: 'Nicht gefunden.' },
        { status: 404 },
      );
    const failure = await failureOf('courses', 'get', course);
    expect(failure._tag).toBe('NotFound');
  });
});

describe('wordhold logout', () => {
  it('ends the session and reports a token it could not remove', async () => {
    answer = () => Response.json({});
    fileSystem = (real) => ({
      ...real,
      rename: () =>
        Effect.fail(
          PlatformError.systemError({
            _tag: 'PermissionDenied',
            module: 'FileSystem',
            method: 'rename',
          }),
        ),
    });
    const failure = await failureOf('logout');
    expect(failure._tag).toBe('SessionStoreFailed');
    expect(failure.message).toContain('wordhold logout');
    expect(sent).toEqual([
      {
        method: 'POST',
        path: signOutPath,
        authorization: `Bearer ${token}`,
        body: {},
      },
    ]);
  });
});

describe('wordhold status', () => {
  it('reports a machine that never signed in to the server', async () => {
    await rm(join(home, 'config'), { recursive: true });
    await runOk('status');
    expect(printed()).toEqual({ server: origin, signedIn: false });
    expect(sent).toEqual([]);
  });
});
