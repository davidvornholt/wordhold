import { and, asc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import type { makeDrizzle } from '../drizzle';
import { entries } from '../schema/entries';
import { pages } from '../schema/pages';
import { units } from '../schema/units';
import { UnitBackfillError } from './unit-backfill-error';

type DrizzleDatabase = ReturnType<typeof makeDrizzle>;
type Transaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

const pageUnitName = (ordinal: number, label: string | null): string => {
  const trimmedLabel = label?.trim();
  return `Einheit ${ordinal}${trimmedLabel ? ` – ${trimmedLabel}` : ''}`;
};

const lockLegacyCourses = async (transaction: Transaction) => {
  const legacyCourses = await transaction
    .selectDistinct({ courseId: entries.courseId })
    .from(entries)
    .where(isNull(entries.unitId))
    .orderBy(asc(entries.courseId));
  for (const course of legacyCourses) {
    // biome-ignore lint/performance/noAwaitInLoops: ordered course locks avoid deadlocks with concurrent imports
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${course.courseId}, 0))`,
    );
  }
  return legacyCourses;
};

const filePageRows = async (
  transaction: Transaction,
  courses: ReadonlyArray<{ readonly courseId: string }>,
) => {
  const pageRows = await transaction
    .selectDistinct({
      id: pages.id,
      courseId: pages.courseId,
      label: pages.label,
      capturedAt: pages.capturedAt,
    })
    .from(pages)
    .innerJoin(
      entries,
      and(eq(entries.pageId, pages.id), isNull(entries.unitId)),
    )
    .orderBy(asc(pages.courseId), asc(pages.capturedAt), asc(pages.id));
  const courseIds = courses.map((course) => course.courseId);
  const maximumPositions =
    courseIds.length === 0
      ? []
      : await transaction
          .select({
            courseId: units.courseId,
            position: max(units.position),
          })
          .from(units)
          .where(inArray(units.courseId, courseIds))
          .groupBy(units.courseId);
  const nextPositions = new Map(
    maximumPositions.map((row) => [row.courseId, (row.position ?? -1) + 1]),
  );
  const ordinals = new Map<string, number>();

  for (const page of pageRows) {
    const ordinal = (ordinals.get(page.courseId) ?? 0) + 1;
    ordinals.set(page.courseId, ordinal);
    const name = pageUnitName(ordinal, page.label);
    const position = nextPositions.get(page.courseId) ?? 0;
    nextPositions.set(page.courseId, position + 1);
    // biome-ignore lint/performance/noAwaitInLoops: each unit must exist before its page entries can reference it
    await transaction
      .insert(units)
      .values({ courseId: page.courseId, name, position })
      .onConflictDoUpdate({
        target: [units.courseId, units.name],
        set: { name },
      });
    const [unit] = await transaction
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.courseId, page.courseId), eq(units.name, name)))
      .limit(1);
    if (unit !== undefined) {
      await transaction
        .update(entries)
        .set({ unitId: unit.id })
        .where(
          and(
            eq(entries.courseId, page.courseId),
            eq(entries.pageId, page.id),
            isNull(entries.unitId),
          ),
        );
    }
  }
  return nextPositions;
};

const fileOrphans = async (
  transaction: Transaction,
  positions: Map<string, number>,
) => {
  const orphanedCourses = await transaction
    .selectDistinct({ courseId: entries.courseId })
    .from(entries)
    .where(isNull(entries.unitId));
  for (const course of orphanedCourses) {
    const name = 'Ohne Einheit';
    const position = positions.get(course.courseId) ?? 0;
    positions.set(course.courseId, position + 1);
    // biome-ignore lint/performance/noAwaitInLoops: each holding unit is allocated inside its course lock
    await transaction
      .insert(units)
      .values({
        courseId: course.courseId,
        isHolding: true,
        name,
        position,
      })
      .onConflictDoUpdate({
        target: [units.courseId, units.name],
        set: { isHolding: true },
      });
    const [unit] = await transaction
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.courseId, course.courseId), eq(units.name, name)))
      .limit(1);
    if (unit !== undefined) {
      await transaction
        .update(entries)
        .set({ unitId: unit.id })
        .where(
          and(eq(entries.courseId, course.courseId), isNull(entries.unitId)),
        );
    }
  }
};

const runBackfillTransaction = (database: DrizzleDatabase) =>
  database.transaction(async (transaction) => {
    const legacyCourses = await lockLegacyCourses(transaction);
    const nextPositions = await filePageRows(transaction, legacyCourses);
    await fileOrphans(transaction, nextPositions);
  });

export const fileLegacyVocabulary = (database: DrizzleDatabase) =>
  Effect.tryPromise({
    try: () => runBackfillTransaction(database),
    catch: (cause) =>
      new UnitBackfillError({
        cause,
        operation: 'file legacy vocabulary',
        message: 'Unit backfill failed: file legacy vocabulary.',
      }),
  });
