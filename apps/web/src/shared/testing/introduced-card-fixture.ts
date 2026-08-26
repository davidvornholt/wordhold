import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';

export const fixtureCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fixtureUnitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unlearnedEntryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const freshEntryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const dueEntryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const fixtureNow = new Date('2026-08-20T12:00:00.000Z');

export const seedIntroducedCardFixture = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${fixtureCourseId}, 'French', 'fr')
  `;
  yield* sql`
    insert into units (id, course_id, name, position)
    values (${fixtureUnitId}, ${fixtureCourseId}, 'Unit 1', 0)
  `;
  yield* sql`
    insert into entries (
      id, course_id, unit_id, type, target_text, native_text
    ) values
      (${unlearnedEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'word', 'neuf', 'neu'),
      (${freshEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'word', 'livre', 'Buch'),
      (${dueEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'word', 'mémoire', 'Erinnerung')
  `;
  yield* sql`
    insert into cards (
      entry_id, direction, introduced_at, state, due_at
    ) values
      (${unlearnedEntryId}, 'to_target', null, 'new', null),
      (${unlearnedEntryId}, 'to_native', null, 'new', null),
      (${freshEntryId}, 'to_target', ${fixtureNow}, 'new', null),
      (${freshEntryId}, 'to_native', ${fixtureNow}, 'new', null),
      (${dueEntryId}, 'to_target', ${fixtureNow}, 'review', ${new Date('2026-08-19T12:00:00.000Z')}),
      (${dueEntryId}, 'to_native', ${fixtureNow}, 'review', ${new Date('2026-08-21T12:00:00.000Z')})
  `;
});
