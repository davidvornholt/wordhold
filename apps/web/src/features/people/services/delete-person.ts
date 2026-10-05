import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { PeopleStore } from './people-store';

// Files go after the deletion committed, so a failed deletion keeps them. A
// file that cannot be removed now is only disk space: the next upload's
// reconciliation removes every file no row refers to.
export const deletePerson = (userId: string) =>
  Effect.gen(function* () {
    const store = yield* PeopleStore;
    const storage = yield* Storage;
    const files = yield* store.remove(userId);
    yield* Effect.forEach(
      files,
      (path) =>
        storage
          .remove(path)
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning(
                'could not remove a deleted person’s file',
                path,
                error.message,
              ),
            ),
          ),
      { discard: true },
    );
  });
