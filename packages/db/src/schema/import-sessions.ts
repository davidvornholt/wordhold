import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

// A tombstone prevents an upload that was already in flight from recreating a
// session after the learner discarded it.
export const importSessionTombstones = pgTable('import_session_tombstones', {
  id: uuid('id').primaryKey(),
  abandonedAt: timestamp('abandoned_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
