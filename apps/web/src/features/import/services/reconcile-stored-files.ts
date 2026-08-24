import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportRepository } from './repository';

export const reconcileStoredFiles = Effect.gen(function* () {
  const repository = yield* ImportRepository;
  const storage = yield* Storage;
  const referencedPaths = yield* repository.referencedPaths;
  return yield* storage.reconcile(referencedPaths);
});
