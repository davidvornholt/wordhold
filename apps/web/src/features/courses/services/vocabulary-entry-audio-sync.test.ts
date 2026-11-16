import { describe, expect, it } from 'bun:test';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { Effect } from 'effect';
import type { StorageShape } from '../../../shared/storage/server';
import { CourseDatabaseError } from '../errors/courses-errors';
import { syncEntryAudio } from './vocabulary-entry-audio';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const unreached = () => Effect.die('not reached');

const run = ({
  needed,
  ttsFails = false,
  lockFails = false,
  replace = false,
}: {
  readonly needed: boolean;
  readonly ttsFails?: boolean;
  readonly lockFails?: boolean;
  readonly replace?: boolean;
}) => {
  const calls = {
    locks: 0,
    replaced: false,
    speech: 0,
    written: 0,
    references: 0,
  };
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
    needsAudio: (_entryId, _targetText, _audioProfile, replaceAudio) =>
      Effect.sync(() => {
        calls.replaced = replaceAudio;
        return needed;
      }),
    withAudioLock: (_entryId, effect) =>
      Effect.suspend(() => {
        calls.locks += 1;
        return Effect.flatMap(
          lockFails
            ? Effect.fail(
                new CourseDatabaseError({
                  operation: 'coordinate entry audio',
                  cause: 'aborted',
                  message: 'down',
                }),
              )
            : Effect.void,
          () => effect,
        );
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
    syncEntryAudio(
      { tts, storage, store },
      { entryId, targetText: 'le nuage', language: 'fr', replace },
    ).pipe(Effect.provide(untrackedAiUsage)),
  ).then((audio) => ({ audio, calls }));
};

const idle = {
  locks: 1,
  replaced: false,
  speech: 0,
  written: 0,
  references: 0,
};

describe('syncEntryAudio', () => {
  it('generates the pronunciation a word needs, under the entry lock', async () => {
    const { audio, calls } = await run({ needed: true });
    expect(audio).toBe('generated');
    expect(calls).toEqual({ ...idle, speech: 1, written: 1, references: 1 });
  });

  it('calls no speech provider when nothing is needed', async () => {
    const { audio, calls } = await run({ needed: false });
    expect(audio).toBe('kept');
    expect(calls).toEqual(idle);
  });

  it('asks to replace the recording of a changed word', async () => {
    const { calls } = await run({ needed: false, replace: true });
    expect(calls.replaced).toBe(true);
  });

  it('reports a failed generation without storing anything', async () => {
    const { audio, calls } = await run({ needed: true, ttsFails: true });
    expect(audio).toBe('failed');
    expect(calls).toEqual({ ...idle, speech: 1 });
  });

  it('reports a failed lock or transaction instead of failing the save', async () => {
    const { audio, calls } = await run({ needed: true, lockFails: true });
    expect(audio).toBe('failed');
    expect(calls).toEqual(idle);
  });
});
