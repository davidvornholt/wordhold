import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportInvariantError } from '../errors/import-invariant-error';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { extractPage } from './extract';
import { extractNotes } from './extract-notes';
import { ImportRepository, type PendingExtraction } from './repository';

// A language page lists vocabulary, a subject's page holds notes on its
// terms. A collection's texts are never photographed.
const readPage = (pending: PendingExtraction, image: Uint8Array) => {
  switch (pending.kind) {
    case 'language':
      return extractPage({ image, language: pending.language });
    case 'terms':
      return extractNotes({ image, imagePath: pending.imagePath });
    default:
      return Effect.fail(
        new ImportInvariantError({
          message: 'Eine Sammlung hat keinen Fotoimport.',
        }),
      );
  }
};

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
    const result = yield* readPage(pending, image);
    const updated = yield* repository.saveExtractionIfPending(pageId, result);
    if (updated === undefined) {
      return yield* new PageNotPendingError({
        message: 'Die Seite wurde während des Auslesens bereits importiert.',
      });
    }
    return updated;
  });
