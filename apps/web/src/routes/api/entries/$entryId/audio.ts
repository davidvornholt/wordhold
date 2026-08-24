import { createFileRoute } from '@tanstack/react-router';
import { entryAudio } from '@wordhold/db/schema/entries';
import { eq } from 'drizzle-orm';
import { requireSession } from '../../../../shared/auth/require-session';
import { db } from '../../../../shared/db/server';
import { privateMediaResponse } from '../../../../shared/storage/media-response';
import { readDataFile } from '../../../../shared/storage/server';

export const Route = createFileRoute('/api/entries/$entryId/audio')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await requireSession();
        const [audio] = await db
          .select()
          .from(entryAudio)
          .where(eq(entryAudio.entryId, params.entryId))
          .limit(1);
        if (audio === undefined) {
          return new Response('Nicht gefunden', { status: 404 });
        }
        const bytes = await readDataFile(audio.path);
        return privateMediaResponse(bytes, 'audio/mpeg');
      },
    },
  },
});
