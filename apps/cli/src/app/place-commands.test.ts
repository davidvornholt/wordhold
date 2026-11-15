import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Entry, Unit } from '@wordhold/api/vocabulary';
import {
  course,
  entryId,
  failureOf,
  printed,
  runOk,
  server,
  startFakeServer,
  stopFakeServer,
  token,
  unit,
} from './command-testing';

const book = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const otherEntry = '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b';

const newUnit: Unit = {
  id: unit,
  name: 'Lektion 2',
  entries: 0,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
};

const moved: Entry = {
  id: entryId,
  course: { id: course, name: 'Spanisch', kind: 'language' },
  book: { id: book, name: 'Buch 1' },
  unit: { id: unit, name: 'Lektion 2' },
  targetText: 'la mesa',
  nativeText: 'der Tisch',
  example: null,
  synonyms: null,
  antonyms: null,
  keyPoints: null,
  introduced: false,
  cards: [],
};

beforeEach(() => startFakeServer(() => Response.json(newUnit)));
afterEach(stopFakeServer);

describe('wordhold units add', () => {
  it('adds a unit with a trimmed name to a book', async () => {
    await runOk(
      'units',
      'add',
      course,
      '--book',
      book,
      '--name',
      ' Lektion 2 ',
    );
    expect(server.sent).toEqual([
      {
        method: 'POST',
        path: `/api/cli/courses/${course}/units`,
        authorization: `Bearer ${token}`,
        body: { bookId: book, name: 'Lektion 2' },
      },
    ]);
    expect(printed()).toEqual(newUnit);
  });

  it.each([
    [[course, '--book', book, '--name', '  ']],
    [[course, '--book', 'Buch 1', '--name', 'Lektion 2']],
  ])('refuses %j before asking the server', async (args) => {
    const failure = await failureOf('units', 'add', ...args);
    expect(failure._tag).toBe('InvalidInput');
    expect(server.sent).toEqual([]);
  });
});

describe('wordhold entries move', () => {
  beforeEach(() => {
    server.answer = () => Response.json([moved]);
  });

  it('moves several words into a unit and prints them', async () => {
    await runOk(
      'entries',
      'move',
      course,
      '--entry',
      entryId,
      '--entry',
      otherEntry,
      '--unit',
      unit,
    );
    expect(server.sent).toEqual([
      {
        method: 'POST',
        path: `/api/cli/courses/${course}/entries/move`,
        authorization: `Bearer ${token}`,
        body: { entryIds: [entryId, otherEntry], unitId: unit },
      },
    ]);
    expect(printed()).toEqual([moved]);
  });

  it('moves words directly into a book', async () => {
    await runOk('entries', 'move', course, '--entry', entryId, '--book', book);
    expect(server.sent[0]?.body).toEqual({ entryIds: [entryId], bookId: book });
  });

  it.each([
    [[course, '--unit', unit]],
    [[course, '--entry', entryId]],
    [[course, '--entry', entryId, '--entry', entryId, '--unit', unit]],
    [[course, '--entry', 'la mesa', '--unit', unit]],
  ])('refuses %j before asking the server', async (args) => {
    const failure = await failureOf('entries', 'move', ...args);
    expect(failure._tag).toBe('InvalidInput');
    expect(server.sent).toEqual([]);
  });
});
