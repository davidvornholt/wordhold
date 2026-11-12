import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { signOutPath } from '@wordhold/api/device-login';
import type { SavedEntry } from '@wordhold/api/vocabulary';
import { Effect, PlatformError } from 'effect';
import {
  course,
  entryId,
  failureOf,
  origin,
  printed,
  runOk,
  server,
  startFakeServer,
  stopFakeServer,
  token,
  unit,
} from './command-testing';

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

beforeEach(() => startFakeServer(() => Response.json(saved)));
afterEach(stopFakeServer);

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
    expect(server.sent).toEqual([
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
    expect(server.sent[0]?.body).toEqual({
      targetText: 'el',
      nativeText: 'der',
    });
  });

  it('rejects a translation without an example before reading the session', async () => {
    await rm(join(server.home, 'config'), { recursive: true });
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
    expect(server.sent).toEqual([]);
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
    expect(server.sent).toEqual([]);
  });
});

describe('wordhold entries edit', () => {
  it('sends only the fields that change', async () => {
    await runOk('entries', 'edit', entryId, '--native', 'der Esstisch');
    expect(server.sent).toEqual([
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
    expect(server.sent[0]?.body).toEqual({ example: null });
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
    expect(server.sent[0]?.body).toEqual({
      synonyms: ['el escritorio', 'la mesa, la tabla'],
    });
  });

  it('removes the antonyms with --no-antonyms and keeps the synonyms', async () => {
    await runOk('entries', 'edit', entryId, '--no-antonyms');
    expect(server.sent[0]?.body).toEqual({ antonyms: [] });
  });

  it.each([
    [[]],
    [['--no-example', '--example', 'La mesa es grande.']],
    [['--no-synonyms', '--synonym', 'el escritorio']],
    [['--antonym', ' ']],
  ])('refuses %j before asking the server', async (flags) => {
    const failure = await failureOf('entries', 'edit', entryId, ...flags);
    expect(failure._tag).toBe('InvalidInput');
    expect(server.sent).toEqual([]);
  });
});

describe('wordhold entries list and search', () => {
  it('passes the filter and unit as query parameters', async () => {
    server.answer = () => Response.json([saved.entry]);
    await runOk('entries', 'list', course, '--filter', 'due', '--unit', unit);
    expect(server.sent[0]?.path).toBe(
      `/api/cli/courses/${course}/entries?filter=due&unit=${unit}`,
    );
    expect(printed()).toEqual([saved.entry]);
  });

  it('searches one course for a trimmed text', async () => {
    server.answer = () => Response.json([saved.entry]);
    await runOk('entries', 'search', ' mesa ', '--course', course);
    expect(server.sent[0]?.path).toBe(
      `/api/cli/entries?query=mesa&course=${course}`,
    );
  });
});

describe('wordhold courses get', () => {
  it('rejects a course id before reading the session or asking the server', async () => {
    await rm(join(server.home, 'config'), { recursive: true });
    const failure = await failureOf('courses', 'get', 'spanisch');
    expect(failure._tag).toBe('InvalidInput');
    expect(server.sent).toEqual([]);
  });

  it('asks to sign in again when the server refuses the session', async () => {
    server.answer = () =>
      Response.json(
        { _tag: 'Unauthorized', message: 'Not signed in.' },
        { status: 401 },
      );
    const failure = await failureOf('courses', 'get', course);
    expect(failure._tag).toBe('NotSignedIn');
    expect(failure.message).toContain('wordhold login');
  });

  it('passes on what Wordhold rejects', async () => {
    server.answer = () =>
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
    server.answer = () => Response.json({});
    server.fileSystem = (real) => ({
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
    expect(server.sent).toEqual([
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
    await rm(join(server.home, 'config'), { recursive: true });
    await runOk('status');
    expect(printed()).toEqual({ server: origin, signedIn: false });
    expect(server.sent).toEqual([]);
  });
});
