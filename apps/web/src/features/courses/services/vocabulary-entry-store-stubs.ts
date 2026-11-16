import { Effect } from 'effect';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

export const staleFiles = ['audio/old-word.mp3', 'audio/old-example.mp3'];

// The pronunciation counts as stored, so an unchanged save calls no speech
// provider and a changed word generates one.
export const idleStoreMethods: Pick<
  VocabularyEntryStore['Service'],
  'move' | 'needsAudio' | 'withAudioLock'
> = {
  move: () => Effect.die('moving is tested on its own'),
  needsAudio: (_entryId, _targetText, _audioProfile, replace) =>
    Effect.succeed(replace),
  withAudioLock: (_entryId, effect) => effect,
};
