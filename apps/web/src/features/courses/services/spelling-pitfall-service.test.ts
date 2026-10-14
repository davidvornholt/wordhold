import { describe, expect, it } from 'bun:test';
import { SpellingPitfalls } from '@wordhold/ai/pitfalls';
import { SpellingPitfallError } from '@wordhold/ai/pitfalls/error';
import type {
  PitfallRequest,
  SpellingPitfall,
} from '@wordhold/ai/pitfalls/schema';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect, Layer } from 'effect';
import { SpellingPitfallService } from './spelling-pitfall-service';
import {
  type PitfallWordContext,
  SpellingPitfallStore,
} from './spelling-pitfall-store';

const adolescentId = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';
const tambienId = '33333333-3333-4333-8333-333333333333';
const respelledId = '44444444-4444-4444-8444-444444444444';

const pitfall = (text: string): SpellingPitfall => ({
  segments: [{ text, tricky: true }],
  note: `Merke dir ${text}.`,
});

const word = (
  entryId: string,
  targetText: string,
  targetLanguage: PitfallWordContext['targetLanguage'],
  pitfalls: ReadonlyArray<SpellingPitfall> | null = null,
): PitfallWordContext => ({
  entryId,
  targetText,
  nativeText: 'Bedeutung',
  targetLanguage,
  pitfalls,
});

const runPrepare = (
  stored: ReadonlyArray<PitfallWordContext>,
  find: (
    request: PitfallRequest,
  ) => Effect.Effect<
    ReadonlyArray<ReadonlyArray<SpellingPitfall>>,
    SpellingPitfallError
  >,
) => {
  const saved: Array<string> = [];
  const result = Effect.runPromise(
    Effect.flatMap(SpellingPitfallService, (service) =>
      service.prepare(stored.map((entry) => entry.entryId)),
    ).pipe(
      Effect.provide(
        SpellingPitfallService.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(SpellingPitfallStore, {
                read: () => Effect.succeed(stored),
                save: ({ entryId }) =>
                  Effect.sync(() => {
                    saved.push(entryId);
                    return entryId !== respelledId;
                  }),
              }),
              Layer.succeed(SpellingPitfalls, { find }),
            ),
          ),
        ),
      ),
      Effect.provide(untrackedAiUsage),
    ),
  );
  return { result, saved };
};

describe('SpellingPitfallService.prepare', () => {
  it('asks once per language for the words without pitfalls', async () => {
    const requests: Array<PitfallRequest> = [];
    const { result, saved } = runPrepare(
      [
        word(adolescentId, 'adolescent', 'en'),
        word(tableId, 'the table', 'en', []),
        word(tambienId, 'también', 'es'),
      ],
      (request) => {
        requests.push(request);
        return Effect.succeed(
          request.words.map((asked) => [pitfall(asked.targetText)]),
        );
      },
    );
    expect(await result).toEqual([
      { entryId: tableId, targetText: 'the table', pitfalls: [] },
      {
        entryId: adolescentId,
        targetText: 'adolescent',
        pitfalls: [pitfall('adolescent')],
      },
      {
        entryId: tambienId,
        targetText: 'también',
        pitfalls: [pitfall('también')],
      },
    ]);
    expect(
      requests.map((request) => [
        request.targetLanguage,
        request.words.map((asked) => asked.targetText),
      ]),
    ).toEqual([
      ['English', ['adolescent']],
      ['Spanish', ['también']],
    ]);
    expect(saved).toEqual([adolescentId, tambienId]);
  });

  it('leaves out words it could not store or find pitfalls for', async () => {
    const { result } = runPrepare(
      [
        word(adolescentId, 'adolescent', 'en'),
        word(respelledId, 'necesary', 'en'),
        word(tambienId, 'también', 'es'),
      ],
      (request) =>
        request.targetLanguage === 'Spanish'
          ? Effect.fail(
              new SpellingPitfallError({
                cause: null,
                message: 'The spelling pitfalls could not be found.',
              }),
            )
          : Effect.succeed(request.words.map(() => [])),
    );
    expect(await result).toEqual([
      { entryId: adolescentId, targetText: 'adolescent', pitfalls: [] },
    ]);
  });
});
