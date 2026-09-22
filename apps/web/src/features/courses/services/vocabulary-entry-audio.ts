import type { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Cause, type Context, Effect } from 'effect';
import {
  speechAudioProfile,
  synthesizeSpeechAudio,
} from '../../../shared/audio/speech-audio';
import { persistFileReference } from '../../../shared/storage/consistency';
import {
  audioRelativePath,
  type Storage,
} from '../../../shared/storage/server';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

type EntryAudioDependencies = {
  readonly tts: Context.Tag.Service<typeof Tts>;
  readonly storage: Context.Tag.Service<typeof Storage>;
  readonly store: Context.Tag.Service<typeof VocabularyEntryStore>;
};

// Pronunciation is generated right away like after an import. A failure is
// reported, not raised: the word is already stored and learnable.
export const prepareEntryAudio = (
  { tts, storage, store }: EntryAudioDependencies,
  entryId: string,
  targetText: string,
  language: LanguageCode,
) =>
  Effect.gen(function* () {
    const audioProfile = speechAudioProfile(targetText, language);
    const result = yield* synthesizeSpeechAudio(tts, targetText, language);
    const path = audioRelativePath(entryId, audioProfile);
    yield* persistFileReference({
      write: storage.write(path, result.audio),
      persistReference: store.storeAudio(entryId, audioProfile, path),
      remove: storage.remove(path),
    });
    return 'generated' as const;
  }).pipe(
    Effect.tapErrorCause((cause) =>
      Effect.logWarning(
        'entry audio generation failed',
        Cause.pretty(cause, { renderErrorCause: true }),
      ),
    ),
    Effect.catchAll(() => Effect.succeed('failed' as const)),
  );
