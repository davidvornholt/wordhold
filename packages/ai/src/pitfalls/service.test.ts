import { describe, expect, it } from 'bun:test';
import { Effect, Layer, Schema } from 'effect';
import { BedrockProvider } from '../providers/bedrock';
import { capturedBedrockModel } from '../testing/bedrock';
import { untrackedAiUsage } from '../testing/usage';
import { type PitfallRequest, PitfallSuggestions } from './schema';
import { pitfallPrompt, SpellingPitfalls } from './service';

const request: PitfallRequest = {
  targetLanguage: 'English',
  words: [
    { targetText: 'adolescent', nativeText: 'Jugendliche/r' },
    { targetText: 'the table', nativeText: 'der Tisch' },
  ],
};

const adolescentPitfall = {
  word: 'adolescent',
  letters: ['sc'],
  misspelling: 'adolesent',
  note: 'Das c hört man nicht, wie in adolescence.',
};

const find = (response: unknown) => {
  const { calls, model } = capturedBedrockModel(response);
  const result = Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* SpellingPitfalls).find(request);
    }).pipe(
      Effect.provide(
        SpellingPitfalls.layer.pipe(
          Layer.provide(Layer.succeed(BedrockProvider, model)),
          Layer.merge(untrackedAiUsage),
        ),
      ),
      Effect.result,
    ),
  );
  return { calls, result };
};

describe('pitfallPrompt', () => {
  it('passes every word with its German meaning as data', () => {
    const prompt = pitfallPrompt(request);
    expect(prompt).toContain('For each English vocabulary item');
    expect(prompt).toContain(
      JSON.stringify([
        { item: 'adolescent', german: 'Jugendliche/r' },
        { item: 'the table', german: 'der Tisch' },
      ]),
    );
  });

  it('leaves most words without pitfalls', () => {
    expect(pitfallPrompt(request)).toContain('most items have none');
  });
});

describe('PitfallSuggestions', () => {
  const decode = Schema.decodeUnknownSync(PitfallSuggestions);

  it('trims fields and lets empty ones through to be dropped later', () => {
    expect(
      decode({
        words: [
          {
            pitfalls: [
              { word: ' age ', letters: [' g '], misspelling: '', note: ' ' },
            ],
          },
        ],
      }),
    ).toEqual({
      words: [
        {
          pitfalls: [
            { word: 'age', letters: ['g'], misspelling: '', note: '' },
          ],
        },
      ],
    });
  });

  it('rejects more than one pitfall per word', () => {
    expect(() =>
      decode({ words: [{ pitfalls: [adolescentPitfall, adolescentPitfall] }] }),
    ).toThrow();
  });
});

describe('SpellingPitfalls', () => {
  it('returns the marked pitfalls of each word with medium reasoning', async () => {
    const { calls, result } = find({
      words: [{ pitfalls: [adolescentPitfall] }, { pitfalls: [] }],
    });
    expect(await result).toMatchObject({
      _tag: 'Success',
      success: [
        [
          {
            segments: [
              { text: 'adoles', tricky: false },
              { text: 'c', tricky: true },
              { text: 'ent', tricky: false },
            ],
            note: adolescentPitfall.note,
          },
        ],
        [],
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.output_config.effort',
      'medium',
    );
  });

  it('rejects an answer that skips a word', async () => {
    const { result } = find({ words: [{ pitfalls: [adolescentPitfall] }] });
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'SpellingPitfallError' },
    });
  });
});
