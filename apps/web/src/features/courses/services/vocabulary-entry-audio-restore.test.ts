import { describe, expect, it } from 'bun:test';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { Effect } from 'effect';
import type { StorageShape } from '../../../shared/storage/server';
import { restoreEntryAudio } from './vocabulary-entry-audio';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const unreached = () => Effect.die('not reached');

const run = ({
  audioPresent,
  ttsFails = false,
}: {
  readonly audioPresent: boolean;
  readonly ttsFails?: boolean;
}) => {
  const calls = { locks: 0, speech: 0, written: 0, references: 0 };
  const storage: StorageShape = {
    read: unreached,
    reconcile: unreached,
    remove: () => Effect.void,
    write: () =>
      Effect.sync(() => {
        calls.written += 1;
      }),
    writeIfAbsent: unreached,
  };
  const store: VocabularyEntryStore['Service'] = {
    readCourse: unreached,
    readPlace: unreached,
    create: unreached,
    update: unreached,
    remove: unreached,
    move: unreached,
    storeAudio: () =>
      Effect.sync(() => {
        calls.references += 1;
      }),
    hasAudio: () => Effect.succeed(audioPresent),
    withAudioLock: (_entryId, effect) =>
      Effect.suspend(() => {
        calls.locks += 1;
        return effect;
      }),
  };
  const tts = Tts.of({
    synthesize: () =>
      Effect.suspend(() => {
        calls.speech += 1;
        return ttsFails
          ? Effect.fail(new TtsError({ cause: 'down' }))
          : Effect.succeed({ audio: new Uint8Array([1]) });
      }),
  });
  return Effect.runPromise(
    restoreEntryAudio({ tts, storage, store }, entryId, 'le nuage', 'fr').pipe(
      Effect.provide(untrackedAiUsage),
    ),
  ).then((audio) => ({ audio, calls }));
};

describe('restoreEntryAudio', () => {
  it('generates the pronunciation a word is missing, under the entry lock', async () => {
    const { audio, calls } = await run({ audioPresent: false });
    expect(audio).toBe('generated');
    expect(calls).toEqual({ locks: 1, speech: 1, written: 1, references: 1 });
  });

  it('calls no speech provider when the pronunciation is stored', async () => {
    const { audio, calls } = await run({ audioPresent: true });
    expect(audio).toBe('kept');
    expect(calls).toEqual({ locks: 1, speech: 0, written: 0, references: 0 });
  });

  it('reports a failed generation without storing anything', async () => {
    const { audio, calls } = await run({
      audioPresent: false,
      ttsFails: true,
    });
    expect(audio).toBe('failed');
    expect(calls).toEqual({ locks: 1, speech: 1, written: 0, references: 0 });
  });
});
