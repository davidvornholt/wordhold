import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { seedOwner } from './owner-fixture';

export const fixtureOwnerId = 'fixture-owner';
export const fixtureCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const fixtureBookId = 'b00cb00c-b00c-4b00-8b00-b00cb00cb00c';
export const fixtureUnitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const unintroducedEntryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const firstReviewEntryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const dueEntryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const fixtureNow = new Date('2026-08-20T12:00:00.000Z');
export const fixtureAddedAt = new Date('2026-08-01T12:00:00.000Z');

export const seedIntroducedCardFixture = Effect.gen(function* () {
  const sql = yield* Database;
  yield* seedOwner(fixtureOwnerId);
  yield* sql`
    insert into courses (id, owner_id, name, target_language)
    values (${fixtureCourseId}, ${fixtureOwnerId}, 'French', 'fr')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${fixtureBookId}, ${fixtureCourseId}, 'Découvertes 3', 0)
  `;
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${fixtureUnitId}, ${fixtureCourseId}, ${fixtureBookId}, 'Unit 1', 0)
  `;
  yield* sql`
    insert into entries (
      id, course_id, book_id, unit_id, target_text, native_text, created_at
    ) values
      (${unintroducedEntryId}, ${fixtureCourseId}, ${fixtureBookId}, ${fixtureUnitId}, 'neuf', 'neu', ${fixtureAddedAt}),
      (${firstReviewEntryId}, ${fixtureCourseId}, ${fixtureBookId}, ${fixtureUnitId}, 'livre', 'Buch', ${fixtureAddedAt}),
      (${dueEntryId}, ${fixtureCourseId}, ${fixtureBookId}, ${fixtureUnitId}, 'mémoire', 'Erinnerung', ${fixtureAddedAt})
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
