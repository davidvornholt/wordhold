import { createFileRoute } from '@tanstack/react-router';
import { courses } from '@wordhold/db/schema/courses';
import { pages } from '@wordhold/db/schema/pages';
import { eq } from 'drizzle-orm';
import { requireSession } from '../../shared/auth/require-session';
import { db } from '../../shared/db/server';
import { extensionForMime, runExtraction } from '../../shared/import/extract';
import {
  pageImageRelativePath,
  toBase64,
  writeDataFile,
} from '../../shared/storage/server';

// Uploads arrive as multipart FormData (courseId + image), which server
// functions do not model well; a plain server route keeps it a standard
// fetch from the capture screen. The page row is committed before extraction
// runs so a model failure never loses the photo.
export const Route = createFileRoute('/api/pages')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireSession();
        const form = await request.formData();
        const courseId = form.get('courseId');
        const image = form.get('image');
        if (typeof courseId !== 'string' || !(image instanceof File)) {
          return Response.json(
            { error: 'courseId und image sind erforderlich.' },
            { status: 400 },
          );
        }
        const extension = extensionForMime(image.type);
        if (extension === undefined) {
          return Response.json(
            { error: `Nicht unterstütztes Bildformat: ${image.type}` },
            { status: 415 },
          );
        }
        const [course] = await db
          .select()
          .from(courses)
          .where(eq(courses.id, courseId));
        if (course === undefined) {
          return Response.json(
            { error: 'Kurs nicht gefunden.' },
            { status: 404 },
          );
        }
        const bytes = new Uint8Array(await image.arrayBuffer());
        const pageId = crypto.randomUUID();
        const imagePath = pageImageRelativePath(pageId, extension);
        await writeDataFile(imagePath, bytes);
        await db.insert(pages).values({ id: pageId, courseId, imagePath });

        let extractionError: string | null = null;
        try {
          const result = await runExtraction({
            imageBase64: toBase64(bytes),
            mediaType: image.type,
            language: course.targetLanguage,
          });
          await db
            .update(pages)
            .set({ extraction: result, label: result.page.pageLabel ?? null })
            .where(eq(pages.id, pageId));
        } catch (error) {
          extractionError =
            error instanceof Error ? error.message : String(error);
        }
        return Response.json({ pageId, extractionError });
      },
    },
  },
});
