import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Effect, Layer } from 'effect';
import { Storage, type StorageShape } from '../../../shared/storage/server';
import type { VocabularyExample } from '../schemas/course-units';
import { VocabularyExampleService } from './vocabulary-example-service';
import {
  type VocabularyExampleContext,
  VocabularyExampleStore,
} from './vocabulary-example-store';

const entryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const generated: VocabularyExample = {
  targetText: 'Je lis un livre.',
  nativeText: 'Ich lese ein Buch.',
  source: 'generated',
};

const context = (
  example: VocabularyExample | null,
): VocabularyExampleContext => ({
  entryId,
  targetText: 'livre',
  nativeText: 'Buch',
  targetLanguage: 'fr',
  example,
  exampleAudioProfile: null,
  exampleAudioPath: null,
});

const runService = (
  initial: VocabularyExampleContext,
  onGenerate: () => void,
  onTranslate: () => void = () => undefined,
) => {
  let current = initial;
  const storage: StorageShape = {
    read: () => Effect.succeed(new Uint8Array()),
    reconcile: () => Effect.succeed([]),
    remove: () => Effect.void,
    write: () => Effect.void,
    writeIfAbsent: () => Effect.void,
  };
  const dependencies = Layer.mergeAll(
    Layer.succeed(VocabularyExampleStore, {
      read: () => Effect.succeed(current),
      storeGenerated: (_id, example) => {
        const stored = { ...example, source: 'generated' as const };
        current = { ...current, example: stored };
        return Effect.succeed(stored);
      },
      storeAudio: (_id, _text, audioProfile, audioPath) => {
        current = {
          ...current,
          exampleAudioProfile: audioProfile,
          exampleAudioPath: audioPath,
        };
        return Effect.succeed(true);
      },
      storeTranslation: (_id, _text, nativeText) => {
        if (current.example === null) {
          return Effect.succeed(false);
        }
        current = {
          ...current,
          example: { ...current.example, nativeText },
        };
        return Effect.succeed(true);
      },
      withCriticalSection: (_id, effect) => effect,
    }),
    Layer.succeed(
      SentenceGen,
      SentenceGen.make({
        generate: () => {
          onGenerate();
          return Effect.succeed({
            sentences: [
              {
                target: generated.targetText,
                native: generated.nativeText ?? '',
              },
            ],
          });
        },
        translate: () => {
          onTranslate();
          return Effect.succeed({ native: generated.nativeText ?? '' });
        },
      }),
    ),
    Layer.succeed(Storage, storage),
    Layer.succeed(
      Tts,
      Tts.make({
        synthesize: () => Effect.succeed({ audio: new Uint8Array([1]) }),
      }),
    ),
  );
  const live = VocabularyExampleService.Default.pipe(
    Layer.provide(dependencies),
  );
  return Effect.runPromise(
    Effect.flatMap(VocabularyExampleService, (service) =>
      service.generate(entryId),
    ).pipe(Effect.provide(live)),
  );
};

describe('VocabularyExampleService', () => {
  it('returns an existing example without paying for another generation', async () => {
    let calls = 0;
    const result = await runService(context(generated), () => {
      calls += 1;
    });
    expect(result).toEqual(generated);
    expect(calls).toBe(0);
  });

  it('generates and stores the first missing example', async () => {
    let calls = 0;
    const result = await runService(context(null), () => {
      calls += 1;
    });
    expect(result).toEqual(generated);
    expect(calls).toBe(1);
  });

  it('adds a German translation without replacing a textbook sentence', async () => {
    let generations = 0;
    let translations = 0;
    const result = await runService(
      context({ ...generated, nativeText: null, source: 'textbook' }),
      () => {
        generations += 1;
      },
      () => {
        translations += 1;
      },
    );
    expect(result).toEqual({ ...generated, source: 'textbook' });
    expect(generations).toBe(0);
    expect(translations).toBe(1);
  });
});
