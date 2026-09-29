import { describe, expect, it } from 'bun:test';
import {
  SentenceGen,
  type WordTranslationRequest,
} from '@wordhold/ai/sentence';
import { SentenceGenError } from '@wordhold/ai/sentence/error';
import { Tts } from '@wordhold/ai/tts';
import { TtsError } from '@wordhold/ai/tts/error';
import type { CourseKind } from '@wordhold/db/schema/courses';
import { Effect, Either, Layer } from 'effect';
import { Storage, type StorageShape } from '../../../shared/storage/server';
import {
  CourseBookNotFoundError,
  CourseKindMismatchError,
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
const bookId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const input = {
  courseId,
  bookId,
  unitId,
  targetText: 'la mémoire',
  nativeText: 'die Erinnerung',
};

type Stubs = {
  readonly createResult?: CreateVocabularyEntryResult;
  readonly courseKnown?: boolean;
  readonly courseKind?: CourseKind;
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
    courseKind = 'language',
    ttsFails = false,
    generatorFails = false,
  }: Stubs = {},
) => {
  const written: Array<string> = [];
  const audioReferences: Array<string> = [];
  const wordRequests: Array<WordTranslationRequest> = [];
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
      readCourse: () =>
        Effect.succeed(
          courseKnown
            ? { kind: courseKind, targetLanguage: 'fr' as const }
            : undefined,
        ),
      readPlace: () =>
        Effect.succeed(
          courseKnown
            ? {
                kind: courseKind,
                targetLanguage: 'fr' as const,
                unitName: 'Unité 1',
              }
            : undefined,
        ),
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
        translateWord: (request) => {
          wordRequests.push(request);
          return Effect.succeed({ translation: 'die Erinnerung' });
        },
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
      Effect.map((result) => ({
        result,
        written,
        audioReferences,
        wordRequests,
      })),
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

  it('names a repeated word and a vanished place as typed failures', async () => {
    const duplicate = await runService((service) => service.create(input), {
      createResult: { kind: 'duplicate', location: 'Green Line 3 · Unit 1' },
    });
    expect(duplicate.result._tag).toBe('Left');
    expect(
      duplicate.result._tag === 'Left' ? duplicate.result.left : undefined,
    ).toBeInstanceOf(VocabularyEntryConflictError);
    const unitMissing = await runService((service) => service.create(input), {
      createResult: { kind: 'place-missing' },
    });
    expect(
      unitMissing.result._tag === 'Left' ? unitMissing.result.left : undefined,
    ).toBeInstanceOf(CourseUnitNotFoundError);
    const bookMissing = await runService(
      (service) => service.create({ ...input, unitId: null }),
      { createResult: { kind: 'place-missing' } },
    );
    expect(
      bookMissing.result._tag === 'Left' ? bookMissing.result.left : undefined,
    ).toBeInstanceOf(CourseBookNotFoundError);
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

  it('proposes the missing side of a word pair with the unit as context', async () => {
    const suggested = await runService((service) =>
      service.suggestTranslation({
        courseId,
        bookId,
        unitId,
        text: 'la mémoire',
        given: 'target',
      }),
    );
    expect(Either.getOrNull(suggested.result)).toEqual({
      translation: 'die Erinnerung',
    });
    expect(suggested.wordRequests).toEqual([
      {
        text: 'la mémoire',
        given: 'target',
        targetLanguage: 'French',
        context: 'Unité 1',
      },
    ]);
    const unitMissing = await runService(
      (service) =>
        service.suggestTranslation({
          courseId,
          bookId,
          unitId,
          text: 'la mémoire',
          given: 'target',
        }),
      { courseKnown: false },
    );
    expect(
      unitMissing.result._tag === 'Left' ? unitMissing.result.left : undefined,
    ).toBeInstanceOf(CourseUnitNotFoundError);
  });
});

describe('VocabularyEntryService for a subject', () => {
  it('refuses words, examples and translations for a subject', async () => {
    const attempts: ReadonlyArray<
      (service: VocabularyEntryService) => Effect.Effect<unknown, unknown>
    > = [
      (service) => service.create(input),
      (service) =>
        service.generateExample({
          courseId,
          targetText: input.targetText,
          nativeText: input.nativeText,
        }),
      (service) =>
        service.translateExample({ courseId, targetText: 'Ce voyage.' }),
      (service) =>
        service.suggestTranslation({
          courseId,
          bookId,
          unitId,
          text: 'la mémoire',
          given: 'target',
        }),
    ];
    const runs = await Promise.all(
      attempts.map((attempt) => runService(attempt, { courseKind: 'terms' })),
    );
    for (const { result, written, wordRequests } of runs) {
      expect(result._tag === 'Left' ? result.left : undefined).toBeInstanceOf(
        CourseKindMismatchError,
      );
      expect(written).toHaveLength(0);
      expect(wordRequests).toHaveLength(0);
    }
  });
});
