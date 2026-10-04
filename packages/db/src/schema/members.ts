import { sql } from 'drizzle-orm';
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// Everyone who may use this Wordhold instance. The administrator signs in
// with the allowlisted GitHub account; everyone else is invited and signs in
// with passkeys. A suspended member keeps their data but cannot sign in.
export const members = pgTable(
  'members',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    admin: boolean('admin').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('members_single_admin')
      .on(table.admin)
      .where(sql`${table.admin}`),
  ],
);

export const accessCodeKinds = ['invitation', 'recovery'] as const;
export type AccessCodeKind = (typeof accessCodeKinds)[number];
export const accessCodeKindEnum = pgEnum('access_code_kind', accessCodeKinds);

// A single-use code that lets one member register a passkey: the first one
// after an invitation, or a replacement for lost passkeys after recovery.
// Only the SHA-256 digest is stored, and each member holds at most one code.
export const accessCodes = pgTable('access_codes', {
  digest: text('digest').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => members.userId, { onDelete: 'cascade' }),
  kind: accessCodeKindEnum('kind').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
