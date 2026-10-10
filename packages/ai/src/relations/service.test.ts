import { describe, expect, it } from 'bun:test';
import { Effect, Layer, Schema } from 'effect';
import { BedrockProvider } from '../providers/bedrock';
import { capturedBedrockModel } from '../testing/bedrock';
import { untrackedAiUsage } from '../testing/usage';
import {
  maximumSuggestedRelations,
  type RelationRequest,
  RelationSuggestions,
} from './schema';
import { relationPrompt, WordRelations } from './service';

const request: RelationRequest = {
  targetLanguage: 'English',
  words: [
    {
      targetText: 'hostile',
      nativeText: 'feindselig',
      example: 'The crowd was hostile.',
    },
    { targetText: 'the table', nativeText: 'der Tisch', example: null },
  ],
};

const suggest = (response: unknown) => {
  const { calls, model } = capturedBedrockModel(response);
  const result = Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* WordRelations).suggest(request);
    }).pipe(
      Effect.provide(
        WordRelations.layer.pipe(
          Layer.provide(Layer.succeed(BedrockProvider, model)),
          Layer.merge(untrackedAiUsage),
        ),
      ),
      Effect.result,
    ),
  );
  return { calls, result };
};

describe('relationPrompt', () => {
  it('passes every word with its sense as data', () => {
    const prompt = relationPrompt(request);
    expect(prompt).toContain('English synonyms and opposites');
    expect(prompt).toContain(
      JSON.stringify([
        {
          item: 'hostile',
          german: 'feindselig',
          example: 'The crowd was hostile.',
        },
        { item: 'the table', german: 'der Tisch', example: null },
      ]),
    );
  });
});

describe('RelationSuggestions', () => {
  const decode = Schema.decodeUnknownSync(RelationSuggestions);

  it('trims suggested words and allows empty lists', () => {
    expect(
      decode({
        words: [{ synonyms: [' unfriendly '], antonyms: [] }],
      }),
    ).toEqual({ words: [{ synonyms: ['unfriendly'], antonyms: [] }] });
  });

  it('rejects blank words and long lists', () => {
    expect(() =>
      decode({ words: [{ synonyms: [' '], antonyms: [] }] }),
    ).toThrow();
    expect(() =>
      decode({
        words: [
          {
            synonyms: Array.from(
              { length: maximumSuggestedRelations + 1 },
              (_, index) => `word ${index}`,
            ),
            antonyms: [],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('WordRelations', () => {
  it('returns one suggestion per word with medium reasoning', async () => {
    const response = {
      words: [
        { synonyms: ['unfriendly'], antonyms: ['friendly'] },
        { synonyms: [], antonyms: [] },
      ],
    };
    const { calls, result } = suggest(response);
    expect(await result).toMatchObject({ _tag: 'Success', success: response });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.output_config.effort',
      'medium',
    );
  });

  it('rejects an answer that skips a word', async () => {
    const { result } = suggest({
      words: [{ synonyms: ['unfriendly'], antonyms: ['friendly'] }],
    });
    expect(await result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'RelationError' },
    });
  });
});
