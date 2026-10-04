import { Effect } from 'effect';
import { ImportRepository } from './repository';

export const audioRecoveryPages = (ownerId: string) =>
  Effect.gen(function* () {
    const repository = yield* ImportRepository;
    return yield* repository.listAudioRecoveryPages(ownerId);
  });
