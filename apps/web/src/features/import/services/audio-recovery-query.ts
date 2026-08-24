import { Effect } from 'effect';
import { ImportRepository } from './repository';

export const audioRecoveryPages = Effect.gen(function* () {
  const repository = yield* ImportRepository;
  return yield* repository.listAudioRecoveryPages;
});
