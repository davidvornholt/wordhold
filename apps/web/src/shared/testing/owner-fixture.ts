import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';

// Adds the Better Auth user that courses belong to through owner_id.
export const seedOwner = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* sql`
      insert into "user" (id, name, email)
      values (${id}, ${id}, ${`${id}@example.com`})
    `;
  });
