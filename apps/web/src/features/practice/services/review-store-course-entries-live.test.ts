import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import {
  firstReviewEntryId,
  fixtureAddedAt,
  fixtureBookId,
  fixtureCourseId,
  fixtureOwnerId,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeReviewStore } from './review-store';
import { runReviewTest } from './review-store-live-test-support';

const novelId = '0a0e0a0e-0a0e-40a0-80a0-0a0e0a0e0a0e';
const secondUnitId = '0b0b0b0b-0b0b-40b0-80b0-0b0b0b0b0b0b';
const otherCourseId = '0c0c0c0c-0c0c-40c0-80c0-0c0c0c0c0c0c';
const otherBookId = '0d0d0d0d-0d0d-40d0-80d0-0d0d0d0d0d0d';

// A second unit and a novel in the fixture's course, and a course of its own
// whose words never count.
const seedCourseEntries = Effect.gen(function* () {
  const sql = yield* Database;
  const later = new Date(fixtureAddedAt.getTime() + 60_000);
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${secondUnitId}, ${fixtureCourseId}, ${fixtureBookId}, 'Unit 2', 1)
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${novelId}, ${fixtureCourseId}, 'Le Petit Prince', 1)
  `;
  yield* sql`
    insert into courses (id, owner_id, name, target_language)
    values (${otherCourseId}, ${fixtureOwnerId}, 'Spanish', 'es')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${otherBookId}, ${otherCourseId}, '¡Vamos!', 0)
  `;
  // Inserted out of teaching order, so only the query orders them.
  yield* sql`
    insert into entries (
      course_id, book_id, unit_id, target_text, native_text, created_at
    ) values
      (${fixtureCourseId}, ${novelId}, null, 'renard', 'Fuchs', ${fixtureAddedAt}),
      (${fixtureCourseId}, ${fixtureBookId}, ${secondUnitId}, 'se concentrer (sur qc)', 'sich auf etw. konzentrieren', ${later}),
      (${otherCourseId}, ${otherBookId}, null, 'concentrarse (en algo)', 'sich auf etw. konzentrieren', ${fixtureAddedAt})
  `;
});

describe('PracticeReviewStore course entries', () => {
  it('lists the other words of the course where the books teach them', async () => {
    const entries = await runReviewTest(
      Effect.gen(function* () {
        yield* seedCourseEntries;
        const store = yield* PracticeReviewStore;
        return yield* store.listCourseEntries(firstReviewEntryId);
      }),
    );
    // The asked word itself and the other course's words are left out; a
    // word without a unit is placed in its book.
    expect(entries).toEqual([
      { text: 'neuf', place: 'Unit 1' },
      { text: 'mémoire', place: 'Unit 1' },
      { text: 'se concentrer (sur qc)', place: 'Unit 2' },
      { text: 'renard', place: 'Le Petit Prince' },
    ]);
  });
});
