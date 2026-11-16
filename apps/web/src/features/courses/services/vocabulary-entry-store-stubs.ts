import { Effect } from 'effect';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

// Files a removed or replaced entry leaves without a reference.
export const staleFiles = ['audio/old-word.mp3', 'audio/old-example.mp3'];

// Store methods that tests of the service's other paths never exercise. The
// pronunciation counts as stored, so an unchanged save calls no speech provider.
export const idleStoreMethods: Pick<
  VocabularyEntryStore['Service'],
  'move' | 'hasAudio' | 'withAudioLock'
> = {
  move: () => Effect.die('moving is tested on its own'),
  hasAudio: () => Effect.succeed(true),
  withAudioLock: (_entryId, effect) => effect,
};
