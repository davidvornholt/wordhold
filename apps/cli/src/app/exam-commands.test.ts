import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Exam } from '@wordhold/api/exams';
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

const examId = '9c8b7a6f-5e4d-4c3b-8a29-1f0e0d0c0b0a';

const exam: Exam = {
  id: examId,
  courseId: course,
  name: 'Vokabeltest Lektion 1',
  directions: ['to_target', 'to_native'],
  createdAt: '2026-11-10T16:00:00.000Z',
  archivedAt: null,
  entryCount: 1,
  entries: [{ id: entryId, targetText: 'la mesa', nativeText: 'der Tisch' }],
  cards: { learned: 2, unlearned: 0, unlearnedEntryIds: [] },
  rounds: [],
  openRound: null,
  readiness: {
    lastRound: null,
    previousRound: null,
    rightTwice: null,
    missed: [],
  },
};

beforeEach(() => startFakeServer(() => Response.json(exam)));
afterEach(stopFakeServer);

describe('wordhold exams', () => {
  it('creates a test from single words and whole units', async () => {
    await runOk(
      'exams',
      'create',
      course,
      '--name',
      ' Vokabeltest Lektion 1 ',
      '--direction',
      'to_target',
      '--direction',
      'to_native',
      '--entry',
      entryId,
      '--unit',
      unit,
    );
    expect(server.sent).toEqual([
      {
        method: 'POST',
        path: `/api/cli/courses/${course}/exams`,
        authorization: `Bearer ${token}`,
        body: {
          name: 'Vokabeltest Lektion 1',
          directions: ['to_target', 'to_native'],
          entryIds: [entryId],
          unitIds: [unit],
        },
      },
    ]);
    expect(printed()).toEqual(exam);
  });

  it('sends only the changes, with removals and the archive state', async () => {
    await runOk(
      'exams',
      'edit',
      examId,
      '--add-unit',
      unit,
      '--remove-entry',
      entryId,
      '--archive',
    );
    expect(server.sent[0]).toMatchObject({
      method: 'PATCH',
      path: `/api/cli/exams/${examId}`,
      body: { addUnitIds: [unit], removeEntryIds: [entryId], archived: true },
    });
  });

  it.each([
    [['create', course, '--name', 'Test', '--direction', 'to_target']],
    [['create', course, '--name', 'Test', '--entry', entryId]],
    [['edit', examId]],
    [['edit', examId, '--archive', '--unarchive']],
    [['edit', examId, '--add-entry', 'la mesa']],
  ])('refuses %j before asking the server', async (args) => {
    const failure = await failureOf('exams', ...args);
    expect(failure._tag).toBe('InvalidInput');
    expect(server.sent).toEqual([]);
  });
});
