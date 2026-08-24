import { createServerFn } from '@tanstack/react-start';
import { courses } from '@wordhold/db/schema/courses';
import { entries } from '@wordhold/db/schema/entries';
import { cards, reviews } from '@wordhold/db/schema/practice';
import { and, desc, eq, gte, isNotNull, lt, lte, ne, sql } from 'drizzle-orm';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { serverEnv } from '../env/server';
import { ratings } from '../practice/rating';
import { ownerDayBounds } from './day-boundary';

// Fragile words: entries the schedule keeps bouncing back — at least two
// Again-ratings inside the recent window.
const fragileWindowDays = 30;
const fragileMinFailures = 2;
const fragileLimit = 8;

const countInt = sql<number>`count(*)::int`;

const courseCounts = async () => {
  const now = new Date();
  const [due, fresh, words] = await Promise.all([
    db
      .select({ courseId: entries.courseId, count: countInt })
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .where(
        and(
          ne(cards.state, 'new'),
          isNotNull(cards.dueAt),
          lte(cards.dueAt, now),
        ),
      )
      .groupBy(entries.courseId),
    db
      .select({ courseId: entries.courseId, count: countInt })
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .where(eq(cards.state, 'new'))
      .groupBy(entries.courseId),
    db
      .select({ courseId: entries.courseId, count: countInt })
      .from(entries)
      .groupBy(entries.courseId),
  ]);
  const byCourse = new Map<
    string,
    { due: number; fresh: number; words: number }
  >();
  const slot = (courseId: string) => {
    const existing = byCourse.get(courseId);
    if (existing !== undefined) {
      return existing;
    }
    const created = { due: 0, fresh: 0, words: 0 };
    byCourse.set(courseId, created);
    return created;
  };
  for (const row of due) {
    slot(row.courseId).due = row.count;
  }
  for (const row of fresh) {
    slot(row.courseId).fresh = row.count;
  }
  for (const row of words) {
    slot(row.courseId).words = row.count;
  }
  return [...byCourse.entries()].map(([courseId, counts]) => ({
    courseId,
    ...counts,
  }));
};

const fragileWords = () =>
  db
    .select({
      entryId: entries.id,
      targetText: entries.targetText,
      nativeText: entries.nativeText,
      courseName: courses.name,
      failures: countInt,
    })
    .from(reviews)
    .innerJoin(cards, eq(reviews.cardId, cards.id))
    .innerJoin(entries, eq(cards.entryId, entries.id))
    .innerJoin(courses, eq(entries.courseId, courses.id))
    .where(
      and(
        eq(reviews.rating, ratings.again),
        gte(
          reviews.reviewedAt,
          sql`now() - make_interval(days => ${fragileWindowDays})`,
        ),
      ),
    )
    .groupBy(entries.id, entries.targetText, entries.nativeText, courses.name)
    .having(gte(countInt, fragileMinFailures))
    .orderBy(desc(countInt))
    .limit(fragileLimit);

const reviewsToday = async () => {
  // Absolute UTC bounds keep the result independent of PostgreSQL's session
  // time zone. The end stays exclusive so midnight belongs to the next day.
  const { startInclusive, endExclusive } = ownerDayBounds(
    new Date(),
    serverEnv.ownerTimeZone(),
  );
  const [row] = await db
    .select({ count: countInt })
    .from(reviews)
    .where(
      and(
        gte(reviews.reviewedAt, startInclusive),
        lt(reviews.reviewedAt, endExclusive),
      ),
    );
  return row?.count ?? 0;
};

export const getDashboard = createServerFn().handler(async () => {
  await requireSession();
  const [perCourse, fragile, today] = await Promise.all([
    courseCounts(),
    fragileWords(),
    reviewsToday(),
  ]);
  return { perCourse, fragile, reviewsToday: today };
});
