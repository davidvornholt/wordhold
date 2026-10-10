import { Effect, Result } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { type ImportPageRemoval, ImportRepository } from './repository';

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
      (imagePath) => storage.remove(imagePath).pipe(Effect.result),
      { concurrency: 3 },
    );
    // The database row is authoritative. A failed file removal leaves an
    // unreferenced generated file for the existing reconciliation pass.
    return { cleanupPending: cleanup.some(Result.isFailure) };
  });

export const discardPendingImportPage = (removal: ImportPageRemoval) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    const storage = yield* Storage;
    const removed = yield* repository.removePendingImportPage(removal);
    if (removed === undefined) {
      return yield* new PageNotPendingError({
        message:
          'Die Prüfung dieses Stapels hat begonnen. Seiten lassen sich nicht mehr entfernen.',
      });
    }
    if (removed.imagePath === null) {
      return { cleanupPending: false };
    }
    const cleanup = yield* storage
      .remove(removed.imagePath)
      .pipe(Effect.result);
    return { cleanupPending: Result.isFailure(cleanup) };
  });
