import { createFileRoute } from '@tanstack/react-router';
import { pages } from '@wordhold/db/schema/pages';
import { eq } from 'drizzle-orm';
import { requireSession } from '../../../../shared/auth/require-session';
import { db } from '../../../../shared/db/server';
import { mimeForPath } from '../../../../shared/import/extract';
import { readDataFile } from '../../../../shared/storage/server';

export const Route = createFileRoute('/api/pages/$pageId/image')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await requireSession();
        const [page] = await db
          .select()
          .from(pages)
          .where(eq(pages.id, params.pageId));
        if (page === undefined) {
          return new Response('Nicht gefunden', { status: 404 });
        }
        const bytes = await readDataFile(page.imagePath);
        return new Response(bytes, {
          headers: {
            'cache-control': 'private, max-age=31536000, immutable',
            'content-type': mimeForPath(page.imagePath),
          },
        });
      },
    },
  },
});
