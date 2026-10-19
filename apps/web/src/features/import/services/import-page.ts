import { Effect } from 'effect';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { PageNotFoundError } from '../errors/page-not-found-error';
import { PageReviewOrderError } from '../errors/page-review-order-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import type { TermPayloadData } from '../schemas/term-payload';
import { generateAudio } from './audio-generation';
import { reconcileStoredFiles } from './reconcile-stored-files';
import { ImportRepository } from './repository';

// The page the learner checked, once it is the next one due in its complete
// batch.
const pageDueForReview = (pageId: string) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const row = yield* repository.getPage(pageId);
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
    if (session === undefined || !session.isComplete) {
      return yield* new PageReviewOrderError({
        message: 'Warte, bis alle Seiten im Stapel verarbeitet sind.',
      });
    }
    if (firstPendingPage?.id !== row.page.id) {
      return yield* new PageReviewOrderError({
        message: 'Prüfe zuerst die vorherige Seite im Stapel.',
      });
    }
    return row;
  });

const otherKindOfPage = new ImportInvariantError({
  message: 'Diese Seite gehört zu einem anderen Kurs. Lade die Seite neu.',
});

export const importVerifiedPage = (payload: ImportPayloadData) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const row = yield* pageDueForReview(payload.pageId);
    if (row.course.kind !== 'language') {
      return yield* otherKindOfPage;
    }
    yield* reconcileStoredFiles;
    const inserted = yield* repository.verifyPage(payload, row.page.courseId);
    const audio = yield* generateAudio(inserted, row.course.targetLanguage);
    return { imported: inserted.length, audio };
  });

// A subject's terms have no audio. Their key points are derived after the
// save, like those of a typed term.
export const importVerifiedTermPage = (payload: TermPayloadData) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const row = yield* pageDueForReview(payload.pageId);
    if (row.course.kind !== 'terms') {
      return yield* otherKindOfPage;
    }
    yield* reconcileStoredFiles;
    const entryIds = yield* repository.verifyTermPage(
      payload,
      row.page.courseId,
    );
    return { courseId: row.page.courseId, entryIds };
  });
