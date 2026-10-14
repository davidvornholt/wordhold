import { describe, expect, it } from 'bun:test';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { Effect } from 'effect';
import type { StorageShape } from '../../../shared/storage/server';
import { prepareEntryAudio } from './vocabulary-entry-audio';
import type { VocabularyEntryStore } from './vocabulary-entry-store';

const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// Nothing is stored once the synthesis fails.
const unreached = () => Effect.die('not reached after a failed synthesis');

const storage: StorageShape = {
  read: unreached,
  reconcile: unreached,
  remove: unreached,
  write: unreached,
  writeIfAbsent: unreached,
};

const store: VocabularyEntryStore['Service'] = {
  readCourse: unreached,
  readPlace: unreached,
  create: unreached,
  update: unreached,
  remove: unreached,
  storeAudio: unreached,
};

const tts = Tts.of({
  synthesize: () => Effect.fail(new TtsError({ cause: 'down' })),
});

describe('prepareEntryAudio', () => {
  // Libraries such as undici and the AI SDK set Error.stackTraceLimit to 0
  // while they build errors, so logging the failure must not need a stack.
  it('reports a failed pronunciation even when errors carry no stack', async () => {
    const { stackTraceLimit } = Error;
    Error.stackTraceLimit = 0;
    try {
      const audio = await Effect.runPromise(
        prepareEntryAudio(
          { tts, storage, store },
          entryId,
          'la mémoire',
          'fr',
        ).pipe(Effect.provide(untrackedAiUsage)),
      );
      expect(audio).toBe('failed');
    } finally {
      Error.stackTraceLimit = stackTraceLimit;
    }
  });
});
