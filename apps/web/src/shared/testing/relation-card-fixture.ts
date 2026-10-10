import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { writeRelatedWords } from '../vocabulary/related-words-store';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureNow,
} from './introduced-card-fixture';

export const fixtureSynonyms = ['souvenir', 'réminiscence'];
export const synonymDueAt = new Date('2026-08-19T12:00:00.000Z');

// On top of the introduced-card fixture: the due word gains synonyms, and
// with them a synonym card that has been learned and is due with its
// translation.
export const seedDueSynonymCard = Effect.gen(function* () {
  const sql = yield* Database;
  yield* writeRelatedWords(sql, [
    {
      courseId: fixtureCourseId,
      entryId: dueEntryId,
      synonyms: fixtureSynonyms,
      antonyms: [],
    },
  ]);
  yield* sql`
    update cards
    set introduced_at = ${fixtureNow}, state = 'review',
      due_at = ${synonymDueAt}, stability = 10, difficulty = 5, reps = 4,
      scheduled_days = 10, last_reviewed_at = ${new Date('2026-08-09T12:00:00.000Z')}
    where entry_id = ${dueEntryId} and direction = 'to_synonym'
  `;
});
