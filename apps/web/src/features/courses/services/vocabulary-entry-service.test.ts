import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { SentenceGenError } from '@wordhold/ai/sentence/error';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import { Effect, Either, Layer } from 'effect';
import { Storage, type StorageShape } from '../../../shared/storage/server';
import {
  CourseSettingsNotFoundError,
  CourseUnitNotFoundError,
  VocabularyEntryConflictError,
} from '../errors/courses-errors';
import { VocabularyEntryService } from './vocabulary-entry-service';
import {
  type CreateVocabularyEntryResult,
  VocabularyEntryStore,
} from './vocabulary-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const input = {
  courseId,
  unitId,
  targetText: 'la mémoire',
  nativeText: 'die Erinnerung',
};

type Stubs = {
  readonly createResult?: CreateVocabularyEntryResult;
  readonly courseKnown?: boolean;
  readonly ttsFails?: boolean;
  readonly generatorFails?: boolean;
};

const runService = <A, E>(
  use: (
    service: VocabularyEntryService,
  ) => Effect.Effect<A, E, VocabularyEntryService>,
  {
    createResult = { kind: 'created', entryId },
    courseKnown = true,
    ttsFails = false,
    generatorFails = false,
  }: Stubs = {},
) => {
  const written: Array<string> = [];
  const audioReferences: Array<string> = [];
  const storage: StorageShape = {
    read: () => Effect.succeed(new Uint8Array()),
    reconcile: () => Effect.succeed([]),
    remove: () => Effect.void,
    write: (path) => {
      written.push(path);
      return Effect.void;
    },
    writeIfAbsent: () => Effect.void,
  };
  const dependencies = Layer.mergeAll(
    Layer.succeed(VocabularyEntryStore, {
      readTargetLanguage: () =>
        Effect.succeed(courseKnown ? ('fr' as const) : undefined),
      create: () => Effect.succeed(createResult),
      storeAudio: (_entryId, profile) => {
        audioReferences.push(profile);
        return Effect.void;
      },
    }),
    Layer.succeed(
      SentenceGen,
      SentenceGen.make({
        generate: () =>
          generatorFails
            ? Effect.fail(new SentenceGenError({ cause: 'down' }))
            : Effect.succeed({
                sentences: [
                  {
                    target: 'Ce voyage est un bon souvenir.',
                    native: 'Diese Reise ist eine schöne Erinnerung.',
                  },
                ],
              }),
        translate: () =>
          Effect.succeed({ native: 'Diese Reise ist eine schöne Erinnerung.' }),
      }),
    ),
    Layer.succeed(Storage, storage),
    Layer.succeed(
      Tts,
      Tts.make({
        synthesize: () =>
          ttsFails
            ? Effect.fail(new TtsError({ cause: 'down' }))
            : Effect.succeed({ audio: new Uint8Array([1]) }),
      }),
    ),
  );
  const live = VocabularyEntryService.Default.pipe(Layer.provide(dependencies));
  return Effect.runPromise(
    Effect.flatMap(VocabularyEntryService, use).pipe(
      Effect.provide(live),
      Effect.either,
      Effect.map((result) => ({ result, written, audioReferences })),
    ),
  );
};

describe('VocabularyEntryService', () => {
  it('stores the entry and its pronunciation', async () => {
    const { result, written, audioReferences } = await runService((service) =>
      service.create(input),
    );
    expect(Either.getOrNull(result)).toEqual({
      entryId,
      audio: 'generated',
    });
    expect(written).toHaveLength(1);
    expect(audioReferences).toHaveLength(1);
  });

  it('keeps the entry and reports when the pronunciation cannot be made', async () => {
    const { result, audioReferences } = await runService(
      (service) => service.create(input),
      { ttsFails: true },
    );
    expect(Either.getOrNull(result)).toEqual({ entryId, audio: 'failed' });
    expect(audioReferences).toHaveLength(0);
  });

  it('names a repeated word and a vanished unit as typed failures', async () => {
    const duplicate = await runService((service) => service.create(input), {
      createResult: { kind: 'duplicate' },
    });
    expect(duplicate.result._tag).toBe('Left');
    expect(
      duplicate.result._tag === 'Left' ? duplicate.result.left : undefined,
    ).toBeInstanceOf(VocabularyEntryConflictError);
    const unitMissing = await runService((service) => service.create(input), {
      createResult: { kind: 'unit-missing' },
    });
    expect(
      unitMissing.result._tag === 'Left' ? unitMissing.result.left : undefined,
    ).toBeInstanceOf(CourseUnitNotFoundError);
    const courseMissing = await runService((service) => service.create(input), {
      courseKnown: false,
    });
    expect(
      courseMissing.result._tag === 'Left'
        ? courseMissing.result.left
        : undefined,
    ).toBeInstanceOf(CourseSettingsNotFoundError);
  });

  it('generates and translates draft examples in the course language', async () => {
    const generated = await runService((service) =>
      service.generateExample({
        courseId,
        targetText: input.targetText,
        nativeText: input.nativeText,
      }),
    );
    expect(Either.getOrNull(generated.result)).toEqual({
      target: 'Ce voyage est un bon souvenir.',
      native: 'Diese Reise ist eine schöne Erinnerung.',
    });
    const translated = await runService((service) =>
      service.translateExample({
        courseId,
        targetText: 'Ce voyage est un bon souvenir.',
      }),
    );
    expect(Either.getOrNull(translated.result)).toEqual({
      native: 'Diese Reise ist eine schöne Erinnerung.',
    });
    const failed = await runService(
      (service) =>
        service.generateExample({
          courseId,
          targetText: input.targetText,
          nativeText: input.nativeText,
        }),
      { generatorFails: true },
    );
    expect(
      failed.result._tag === 'Left' ? failed.result.left._tag : undefined,
    ).toBe('CourseExampleGenerationError');
  });
});
