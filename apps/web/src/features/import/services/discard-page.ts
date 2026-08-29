import { Effect, Either } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { ImportRepository } from './repository';

export const discardPendingPage = (pageId: string) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const imagePath = yield* repository.deletePendingPage(pageId);
    if (imagePath === undefined) {
      return yield* new PageNotPendingError({
        message: 'Nur offene Importe können gelöscht werden.',
      });
    }
    const cleanup = yield* storage.remove(imagePath).pipe(Effect.either);
    // The database row is authoritative. A failed file removal leaves an
    // unreferenced generated file for the existing reconciliation pass.
    return { cleanupPending: Either.isLeft(cleanup) };
  });
