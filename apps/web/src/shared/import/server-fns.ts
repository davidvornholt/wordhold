import { createServerFn } from '@tanstack/react-start';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { courses } from '@wordhold/db/schema/courses';
import { pages } from '@wordhold/db/schema/pages';
import { asc, eq } from 'drizzle-orm';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { readDataFile, toBase64 } from '../storage/server';
import { mimeForPath, runExtraction } from './extract';

const requireString = (input: unknown): string => {
  if (typeof input !== 'string') {
    throw new Error('Ungültige Eingabe.');
  }
  return input;
};

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
  const existing = await db.select().from(courses).orderBy(asc(courses.name));
  if (existing.length > 0) {
    return existing;
  }
  return db
    .insert(courses)
    .values(seedCourses.map((course) => ({ ...course })))
    .returning();
});

export const getCourse = createServerFn()
  .inputValidator(requireString)
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
  .inputValidator(requireString)
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
  .inputValidator(requireString)
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
    const bytes = await readDataFile(row.pages.imagePath);
    const result = await runExtraction({
      imageBase64: toBase64(bytes),
      mediaType: mimeForPath(row.pages.imagePath),
      language: row.courses.targetLanguage,
    });
    const [updated] = await db
      .update(pages)
      .set({
        extraction: result,
        label: row.pages.label ?? result.page.pageLabel ?? null,
      })
      .where(eq(pages.id, data))
      .returning();
    if (updated === undefined) {
      throw new Error('Seite nicht gefunden.');
    }
    return {
      ...updated,
      extraction: updated.extraction as ExtractionResult | null,
    };
  });
