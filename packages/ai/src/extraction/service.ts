import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { extractionEscalationModel, extractionModel } from '../config';
import { VertexProvider } from '../providers/vertex';
import { providerJsonSchema } from '../structured-output';
import { ExtractionError } from './error';
import { ExtractedPage, type ExtractedPageData } from './schema';

const ESCALATION_THRESHOLD = 0.8;

export type PageImage = {
  readonly imageBase64: string;
  readonly mediaType: string;
  readonly targetLanguage: string;
};

export const extractionPrompt = (targetLanguage: string): string =>
  [
    'This is a photo of a vocabulary page from a German school textbook for',
    `learning ${targetLanguage}. Extract every vocabulary entry in reading`,
    'order. For each entry give the text in the target language, the German',
    'translation, grammar details when printed (gender, plural, irregular',
    'forms), and the printed',
    'example sentence if there is one. Copy text exactly as printed,',
    'including accents. Report a confidence between 0 and 1 per entry and',
    'overall; lower it whenever print is unclear or cropped. If one printed',
    'page number is visible, report its integer value as pageNumber and your',
    'confidence in that reading as pageNumberConfidence. Do not infer a page',
    'number from neighboring content. Omit both fields when no printed page',
    'number is visible. If a visible unit heading clearly applies to this',
    'vocabulary, report only its unit name as unitName.',
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
      const primaryId = yield* extractionModel;
      const escalationId = yield* extractionEscalationModel;

      const pageOutput = providerJsonSchema(ExtractedPage);
      const decodePage = Schema.decodeUnknown(ExtractedPage);

      const callModel = (modelId: string, input: PageImage) =>
        Effect.tryPromise({
          try: async () => {
            const { output } = await generateText({
              model: vertex(modelId),
              output: Output.object({ schema: pageOutput }),
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
          catch: (cause) => new ExtractionError({ cause }),
        });

      const runModel = (
        modelId: string,
        input: PageImage,
      ): Effect.Effect<ExtractedPageData, ExtractionError> =>
        callModel(modelId, input).pipe(
          Effect.flatMap((output) =>
            decodePage(output).pipe(
              Effect.mapError((cause) => new ExtractionError({ cause })),
            ),
          ),
        );

      // Fast model first; escalate to the strong model when the fast one is
      // unsure or finds nothing.
      const extract = (
        input: PageImage,
      ): Effect.Effect<ExtractionResult, ExtractionError> =>
        Effect.gen(function* () {
          const first = yield* runModel(primaryId, input);
          if (
            first.overallConfidence >= ESCALATION_THRESHOLD &&
            first.entries.length > 0
          ) {
            return { page: first, modelId: primaryId };
          }
          const escalated = yield* runModel(escalationId, input);
          return { page: escalated, modelId: escalationId };
        });

      return { extract } as const;
    }),
  },
) {}
