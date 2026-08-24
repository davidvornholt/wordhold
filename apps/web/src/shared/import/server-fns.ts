import { createServerFn } from '@tanstack/react-start';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { courses } from '@wordhold/db/schema/courses';
import { pages } from '@wordhold/db/schema/pages';
import { and, asc, eq, sql } from 'drizzle-orm';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { readDataFile, toBase64 } from '../storage/server';
import { requireString } from '../validate/input';
import { listOrSeedCourses } from './course-seeding';
import { mimeForPath, runExtraction } from './extract';
import { retryPendingExtraction } from './extraction-retry';

// The three courses exist from day one; seeding on first read keeps setup
// at zero steps. Names can be edited in the database once textbooks are
// pinned down.
const seedCourses = [
  { name: 'Englisch', targetLanguage: 'en' },
  { name: 'Französisch', targetLanguage: 'fr' },
  { name: 'Spanisch', targetLanguage: 'es' },
] as const;

export const listCourses = createServerFn().handler(async () => {
  await requireSession();
  return listOrSeedCourses<typeof courses.$inferSelect>({
    withCriticalSection: async (work) =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('wordhold:seed-courses', 0))`,
        );
        return work({
          list: () => tx.select().from(courses).orderBy(asc(courses.name)),
          insertSeeds: () =>
            tx
              .insert(courses)
              .values(seedCourses.map((course) => ({ ...course })))
              .returning(),
        });
      }),
  });
});

export const getCourse = createServerFn()
  .validator(requireString)
  .handler(async ({ data }) => {
    await requireSession();
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, data));
    if (course === undefined) {
      throw new Error('Kurs nicht gefunden.');
    }
    return course;
  });

export const listPendingPages = createServerFn().handler(async () => {
  await requireSession();
  return db
    .select({
      id: pages.id,
      courseId: pages.courseId,
      courseName: courses.name,
      label: pages.label,
      capturedAt: pages.capturedAt,
    })
    .from(pages)
    .innerJoin(courses, eq(pages.courseId, courses.id))
    .where(eq(pages.status, 'awaiting_verification'))
    .orderBy(asc(pages.capturedAt));
});

export const getPage = createServerFn()
  .validator(requireString)
  .handler(async ({ data }) => {
    await requireSession();
    const [row] = await db
      .select()
      .from(pages)
      .innerJoin(courses, eq(pages.courseId, courses.id))
      .where(eq(pages.id, data));
    if (row === undefined) {
      throw new Error('Seite nicht gefunden.');
    }
    return {
      // The jsonb column is untyped at the database layer; this boundary is
      // the single place that reasserts the stored extraction shape.
      page: {
        ...row.pages,
        extraction: row.pages.extraction as ExtractionResult | null,
      },
      course: row.courses,
    };
  });

export const retryExtraction = createServerFn({ method: 'POST' })
  .validator(requireString)
  .handler(async ({ data }) => {
    await requireSession();
    const updated = await retryPendingExtraction({
      loadPending: async () => {
        const [row] = await db
          .select()
          .from(pages)
          .innerJoin(courses, eq(pages.courseId, courses.id))
          .where(
            and(eq(pages.id, data), eq(pages.status, 'awaiting_verification')),
          );
        if (row === undefined) {
          return;
        }
        const bytes = await readDataFile(row.pages.imagePath);
        return {
          imageBase64: toBase64(bytes),
          mediaType: mimeForPath(row.pages.imagePath),
          language: row.courses.targetLanguage,
        };
      },
      extract: runExtraction,
      saveIfPending: async (result) => {
        const [saved] = await db
          .update(pages)
          .set({
            extraction: result,
            label: sql`coalesce(${pages.label}, ${result.page.pageLabel ?? null})`,
          })
          .where(
            and(eq(pages.id, data), eq(pages.status, 'awaiting_verification')),
          )
          .returning();
        return saved;
      },
    });
    return {
      ...updated,
      extraction: updated.extraction as ExtractionResult | null,
    };
  });
