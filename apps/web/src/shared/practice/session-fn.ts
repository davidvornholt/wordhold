import { createServerFn } from '@tanstack/react-start';
import { entries, entryAudio } from '@wordhold/db/schema/entries';
import { cards } from '@wordhold/db/schema/practice';
import { and, asc, eq, isNotNull, lte, ne, sql } from 'drizzle-orm';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { requireString } from '../validate/input';

// Session composition: everything due now, then a bounded batch of new
// cards so a fresh import never floods a single session.
const newCardsPerSession = 10;

const itemColumns = {
  cardId: cards.id,
  direction: cards.direction,
  entryId: entries.id,
  entryType: entries.type,
  targetText: entries.targetText,
  nativeText: entries.nativeText,
  hasAudio: sql<boolean>`exists (
    select 1 from ${entryAudio} where ${entryAudio.entryId} = ${entries.id}
  )`,
} as const;

export const getPracticeSession = createServerFn()
  .validator(requireString)
  .handler(async ({ data: courseId }) => {
    await requireSession();
    const now = new Date();
    const due = await db
      .select(itemColumns)
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .where(
        and(
          eq(entries.courseId, courseId),
          ne(cards.state, 'new'),
          isNotNull(cards.dueAt),
          lte(cards.dueAt, now),
        ),
      )
      .orderBy(asc(cards.dueAt));
    const fresh = await db
      .select(itemColumns)
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .where(and(eq(entries.courseId, courseId), eq(cards.state, 'new')))
      .orderBy(asc(entries.createdAt), asc(cards.direction))
      .limit(newCardsPerSession);
    const items = [...due, ...fresh].map((item) => ({
      ...item,
      prompt:
        item.direction === 'to_target' ? item.nativeText : item.targetText,
    }));
    return { items, dueCount: due.length, newCount: fresh.length };
  });
