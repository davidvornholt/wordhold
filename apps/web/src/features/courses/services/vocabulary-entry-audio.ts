import type { Tts } from '@wordhold/ai/tts';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Cause, Effect, Result } from 'effect';
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
  readonly tts: Tts['Service'];
  readonly storage: Storage['Service'];
  readonly store: VocabularyEntryStore['Service'];
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
    Effect.tapCause((cause) =>
      Effect.logWarning('entry audio generation failed', Cause.pretty(cause)),
    ),
    Effect.catch(() => Effect.succeed('failed' as const)),
  );

export const syncEntryAudio = (
  dependencies: EntryAudioDependencies,
  {
    entryId,
    targetText,
    language,
    replace,
  }: {
    readonly entryId: string;
    readonly targetText: string;
    readonly language: LanguageCode;
    readonly replace: boolean;
  },
) =>
  dependencies.store
    .withAudioLock(
      entryId,
      Effect.gen(function* () {
        const needed = yield* dependencies.store.needsAudio(
          entryId,
          targetText,
          speechAudioProfile(targetText, language),
          replace,
        );
        return needed
          ? yield* prepareEntryAudio(
              dependencies,
              entryId,
              targetText,
              language,
            )
          : ('kept' as const);
      }),
    )
    // The word is already saved. A failure of the lock or of the transaction
    // around the recording, which a failed reference aborts, is reported too.
    .pipe(
      Effect.tapCause((cause) =>
        Effect.logWarning('entry audio sync failed', Cause.pretty(cause)),
      ),
      Effect.catch(() => Effect.succeed('failed' as const)),
    );

// The database is authoritative. A file that cannot be removed stays for the
// reconciliation pass, which removes unreferenced files.
export const removeEntryFiles = (
  storage: Storage['Service'],
  paths: ReadonlyArray<string>,
) =>
  Effect.forEach(paths, (path) => storage.remove(path).pipe(Effect.result), {
    concurrency: 3,
  }).pipe(
    Effect.tap((removals) =>
      removals.some(Result.isFailure)
        ? Effect.logWarning('entry audio removal failed')
        : Effect.void,
    ),
  );
