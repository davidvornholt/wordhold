import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { extractPage } from './extract';
import { ImportRepository } from './repository';

export const retryPendingExtraction = (pageId: string) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const pending = yield* repository.loadPendingExtraction(pageId);
    if (pending === undefined) {
      return yield* new PageNotPendingError({
        message:
          'Nur noch nicht importierte Seiten können erneut ausgelesen werden.',
      });
    }
    const image = yield* storage.read(pending.imagePath);
    const result = yield* extractPage({ image, language: pending.language });
    const updated = yield* repository.saveExtractionIfPending(pageId, result);
    if (updated === undefined) {
      return yield* new PageNotPendingError({
        message: 'Die Seite wurde während des Auslesens bereits importiert.',
      });
    }
    return updated;
  });
