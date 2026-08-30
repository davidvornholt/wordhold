import { Effect } from 'effect';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { PageNotFoundError } from '../errors/page-not-found-error';
import { PageReviewOrderError } from '../errors/page-review-order-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import { generateAudio } from './audio-generation';
import { reconcileStoredFiles } from './reconcile-stored-files';
import { ImportRepository } from './repository';

export const importVerifiedPage = (payload: ImportPayloadData) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const row = yield* repository.getPage(payload.pageId);
    if (row === undefined) {
      return yield* new PageNotFoundError({ message: 'Seite nicht gefunden.' });
    }
    if (row.page.status !== 'awaiting_verification') {
      return yield* new PageAlreadyVerifiedError({
        message: 'Diese Seite wurde bereits importiert.',
      });
    }
    const session = yield* repository.getImportSession(
      row.page.importSessionId,
    );
    const firstPendingPage = session?.pages.find(
      (page) => page.status === 'awaiting_verification',
    );
    if (firstPendingPage?.id !== row.page.id) {
      return yield* new PageReviewOrderError({
        message: 'Prüfe zuerst die vorherige Seite im Stapel.',
      });
    }
    yield* reconcileStoredFiles;
    const inserted = yield* repository.verifyPage(payload, row.page.courseId);
    const audio = yield* generateAudio(inserted, row.course.targetLanguage);
    return { imported: inserted.length, audio };
  });
