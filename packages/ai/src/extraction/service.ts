import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { extractionModel } from '../config';
import { VertexProvider } from '../providers/vertex';
import {
  geminiHighProviderOptions,
  providerJsonSchema,
} from '../structured-output';
import { ExtractionError } from './error';
import { ExtractedPage, type ExtractedPageData } from './schema';

export type PageImage = {
  readonly imageBase64: string;
  readonly mediaType: string;
  readonly targetLanguage: string;
};

export const extractionPrompt = (targetLanguage: string): string =>
  [
    `Extract this German school textbook vocabulary page for ${targetLanguage} in reading order.`,
    'Copy every target entry, German translation, printed grammar and example exactly, including accents.',
    'Translate printed examples faithfully into German as exampleTranslation; invent none.',
    'Give entry and overall confidence from 0 to 1; lower it for unclear or cropped print.',
    'Report pageNumber and pageNumberConfidence only for a visible printed page number; never infer it.',
    'Include unitName only when a visible unit heading clearly applies.',
  ].join('\n');

export type ExtractionResult = {
  readonly page: ExtractedPageData;
  readonly modelId: string;
};

export class Extraction extends Effect.Service<Extraction>()(
  '@wordhold/ai/Extraction',
  {
    effect: Effect.gen(function* () {
      const vertex = yield* VertexProvider;
      const modelId = yield* extractionModel;

      const pageOutput = providerJsonSchema(ExtractedPage);
      const decodePage = Schema.decodeUnknown(ExtractedPage);

      const callModel = (input: PageImage) =>
        Effect.tryPromise({
          try: async () => {
            const { output } = await generateText({
              model: vertex(modelId),
              output: Output.object({ schema: pageOutput }),
              providerOptions: geminiHighProviderOptions,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'file',
                      data: input.imageBase64,
                      mediaType: input.mediaType,
                    },
                    {
                      type: 'text',
                      text: extractionPrompt(input.targetLanguage),
                    },
                  ],
                },
              ],
            });
            return output;
          },
          catch: (cause) =>
            new ExtractionError({
              reason: 'provider',
              message: `The reading service rejected or did not answer the request for ${modelId}.`,
              cause,
            }),
        });

      const runModel = (
        input: PageImage,
      ): Effect.Effect<ExtractedPageData, ExtractionError> =>
        callModel(input).pipe(
          Effect.flatMap((output) =>
            decodePage(output).pipe(
              Effect.mapError(
                (cause) =>
                  new ExtractionError({
                    reason: 'invalidOutput',
                    message: `${modelId} answered outside the page schema.`,
                    cause,
                  }),
              ),
            ),
          ),
        );

      const extract = (
        input: PageImage,
      ): Effect.Effect<ExtractionResult, ExtractionError> =>
        runModel(input).pipe(Effect.map((page) => ({ page, modelId })));

      return { extract } as const;
    }),
  },
) {}
