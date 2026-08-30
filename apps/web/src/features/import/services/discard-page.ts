import { Effect, Either } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { ImportRepository } from './repository';

export const discardPendingImportSession = (sessionId: string) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const imagePaths = yield* repository.deletePendingImportSession(sessionId);
    if (imagePaths.length === 0) {
      return yield* new PageNotPendingError({
        message: 'Nur offene Importe können gelöscht werden.',
      });
    }
    const cleanup = yield* Effect.forEach(
      imagePaths,
      (imagePath) => storage.remove(imagePath).pipe(Effect.either),
      { concurrency: 3 },
    );
    // The database row is authoritative. A failed file removal leaves an
    // unreferenced generated file for the existing reconciliation pass.
    return { cleanupPending: cleanup.some(Either.isLeft) };
  });
