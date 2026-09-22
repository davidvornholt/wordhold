import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { sentenceModel } from '../config';
import {
  maximumEntryTextLength,
  maximumExampleLength,
} from '../extraction/schema';
import { BedrockProvider } from '../providers/bedrock';
import {
  providerJsonSchema,
  structuredOutputOptions,
} from '../structured-output';
import { SentenceGenError } from './error';

const SentenceText = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumExampleLength),
);

export const SentenceBatch = Schema.Struct({
  sentences: Schema.Array(
    Schema.Struct({
      target: SentenceText,
      native: SentenceText,
    }),
  ),
});
export type SentenceBatchData = typeof SentenceBatch.Type;

export const SentenceTranslation = Schema.Struct({ native: SentenceText });
export type SentenceTranslationData = typeof SentenceTranslation.Type;

const WordText = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumEntryTextLength),
);

export const WordTranslation = Schema.Struct({ translation: WordText });
export type WordTranslationData = typeof WordTranslation.Type;

// Which side of a vocabulary pair the learner typed. The other side is
// completed in the form a textbook vocabulary list prints.
export type WordTranslationRequest = {
  readonly text: string;
  readonly given: 'target' | 'native';
  readonly targetLanguage: string;
  // The unit name, when known: "Unit 3 – Holidays" tells "memory" apart from
  // computer memory.
  readonly context?: string;
};

export const sentenceGenerationProviderOptions = {
  openai: {
    ...structuredOutputOptions.openai,
    // Mantle requires the Bedrock-prefixed model ID, which the OpenAI provider
    // cannot classify from its usual gpt-* name.
    forceReasoning: true,
    reasoningEffort: 'medium',
    reasoningSummary: null,
  },
} as const;

export type SentenceRequest = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: string;
  readonly count: number;
};

export const sentencePrompt = (request: SentenceRequest): string =>
  [
    `Write ${request.count} short, natural example sentences in`,
    `${request.targetLanguage} for the vocabulary item`,
    `"${request.targetText}" (German: "${request.nativeText}").`,
    'Use everyday school-life contexts a teenage learner knows. Each sentence',
    'must contain the vocabulary item in a natural form. Provide a faithful',
    'German translation as `native` for every sentence.',
    // Like the judge rule, this is only a best-effort mitigation. Model output
    // remains untrusted and may ignore the instruction or repeat quotation
    // marks from prompt inputs.
    'Never use double quotes or typographic quotation marks; if a sentence',
    "needs a quotation, use single quotes ('wort').",
  ].join(' ');

export const sentenceTranslationPrompt = (
  targetText: string,
  targetLanguage: string,
): string =>
  [
    `Translate this ${targetLanguage} example sentence faithfully into German:`,
    `"${targetText}". Return only the translation as \`native\`.`,
    'Never use double quotes or typographic quotation marks; if the sentence',
    "needs a quotation, use single quotes ('wort').",
  ].join(' ');

export const wordTranslationPrompt = (
  request: WordTranslationRequest,
): string => {
  const [from, to] =
    request.given === 'target'
      ? [request.targetLanguage, 'German']
      : ['German', request.targetLanguage];
  return [
    `Give the ${to} translation of the ${from} vocabulary item`,
    `"${request.text}" as a school textbook vocabulary list would print it.`,
    request.context === undefined
      ? ''
      : `The item belongs to the unit "${request.context}"; pick the meaning that fits it.`,
    'Nouns carry their article, verbs are infinitives (English verbs with',
    "'to'). Return exactly one translation as `translation`, without",
    'explanations or alternatives. Never use double quotes or typographic',
    'quotation marks.',
  ]
    .filter((part) => part !== '')
    .join(' ');
};

export class SentenceGen extends Effect.Service<SentenceGen>()(
  '@wordhold/ai/SentenceGen',
  {
    effect: Effect.gen(function* () {
      const bedrock = yield* BedrockProvider;
      const modelId = yield* sentenceModel;

      const generateStructured = <A, I>(
        schema: Schema.Schema<A, I>,
        prompt: string,
      ): Effect.Effect<A, SentenceGenError> =>
        Effect.tryPromise({
          try: async () => {
            const { output } = await generateText({
              model: bedrock.responses(modelId),
              output: Output.object({ schema: providerJsonSchema(schema) }),
              prompt,
              providerOptions: sentenceGenerationProviderOptions,
            });
            return output;
          },
          catch: (cause) => new SentenceGenError({ cause }),
        }).pipe(
          Effect.flatMap((output) =>
            Schema.decodeUnknown(schema)(output).pipe(
              Effect.mapError((cause) => new SentenceGenError({ cause })),
            ),
          ),
        );

      const generate = (
        request: SentenceRequest,
      ): Effect.Effect<SentenceBatchData, SentenceGenError> =>
        generateStructured(SentenceBatch, sentencePrompt(request));

      const translate = (request: {
        readonly targetText: string;
        readonly targetLanguage: string;
      }): Effect.Effect<SentenceTranslationData, SentenceGenError> =>
        generateStructured(
          SentenceTranslation,
          sentenceTranslationPrompt(request.targetText, request.targetLanguage),
        );

      const translateWord = (
        request: WordTranslationRequest,
      ): Effect.Effect<WordTranslationData, SentenceGenError> =>
        generateStructured(WordTranslation, wordTranslationPrompt(request));

      return { generate, translate, translateWord } as const;
    }),
  },
) {}
