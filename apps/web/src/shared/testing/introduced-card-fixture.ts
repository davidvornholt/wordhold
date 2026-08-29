import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';

export const fixtureCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const fixtureUnitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unintroducedEntryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const firstReviewEntryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
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
      id, course_id, unit_id, target_text, native_text
    ) values
      (${unintroducedEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'neuf', 'neu'),
      (${firstReviewEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'livre', 'Buch'),
      (${dueEntryId}, ${fixtureCourseId}, ${fixtureUnitId}, 'mémoire', 'Erinnerung')
  `;
  yield* sql`
    insert into cards (
      entry_id, direction, introduced_at, state, due_at,
      stability, difficulty, reps, scheduled_days, last_reviewed_at
    ) values
      (${unintroducedEntryId}, 'to_target', null, 'new', null, null, null, 0, 0, null),
      (${unintroducedEntryId}, 'to_native', null, 'new', null, null, null, 0, 0, null),
      (${firstReviewEntryId}, 'to_target', ${fixtureNow}, 'new', null, null, null, 0, 0, null),
      (${firstReviewEntryId}, 'to_native', ${fixtureNow}, 'new', null, null, null, 0, 0, null),
      (${dueEntryId}, 'to_target', ${fixtureNow}, 'review', ${new Date('2026-08-19T12:00:00.000Z')}, 10, 5, 4, 10, ${new Date('2026-08-09T12:00:00.000Z')}),
      (${dueEntryId}, 'to_native', ${fixtureNow}, 'review', ${new Date('2026-08-21T12:00:00.000Z')}, 10, 5, 4, 10, ${new Date('2026-08-11T12:00:00.000Z')})
  `;
});
