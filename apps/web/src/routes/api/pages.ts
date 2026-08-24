import { createFileRoute } from '@tanstack/react-router';
import { courses } from '@wordhold/db/schema/courses';
import { pages } from '@wordhold/db/schema/pages';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '../../shared/auth/require-session';
import { db } from '../../shared/db/server';
import { runExtraction } from '../../shared/import/extract';
import { parseBoundedMultipartFormData } from '../../shared/import/multipart';
import {
  createUploadedPage,
  UploadValidationError,
} from '../../shared/import/upload';
import { reconcileStoredFiles } from '../../shared/storage/reconcile-server';
import {
  removeDataFile,
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
        let form: FormData;
        try {
          form = await parseBoundedMultipartFormData(request);
        } catch (error) {
          if (error instanceof UploadValidationError) {
            return Response.json(
              { error: error.message },
              { status: error.status },
            );
          }
          throw error;
        }
        const courseId = form.get('courseId');
        const image = form.get('image');
        if (typeof courseId !== 'string' || !(image instanceof File)) {
          return Response.json(
            { error: 'courseId und image sind erforderlich.' },
            { status: 400 },
          );
        }
        try {
          const result = await createUploadedPage(courseId, image, {
            findCourse: async (id) => {
              const [course] = await db
                .select({
                  id: courses.id,
                  targetLanguage: courses.targetLanguage,
                })
                .from(courses)
                .where(eq(courses.id, id));
              return course;
            },
            newPageId: () => crypto.randomUUID(),
            reconcile: reconcileStoredFiles,
            writeFile: writeDataFile,
            removeFile: removeDataFile,
            insertPage: async (values) => {
              await db.insert(pages).values(values);
            },
            extract: runExtraction,
            updateExtraction: async (pageId, extraction) => {
              const [updated] = await db
                .update(pages)
                .set({
                  extraction,
                  label: extraction.page.pageLabel ?? null,
                })
                .where(
                  and(
                    eq(pages.id, pageId),
                    eq(pages.status, 'awaiting_verification'),
                  ),
                )
                .returning({ id: pages.id });
              return updated !== undefined;
            },
            toBase64,
          });
          return Response.json(result);
        } catch (error) {
          if (error instanceof UploadValidationError) {
            return Response.json(
              { error: error.message },
              { status: error.status },
            );
          }
          throw error;
        }
      },
    },
  },
});
