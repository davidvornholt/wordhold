import { Context, Effect, Layer } from 'effect';
import { BedrockProvider, productionModelId } from '../providers/bedrock';
import { generateStructured } from '../structured-generation';
import { UnusableAnswerError } from '../unusable-answer-error';
import type { AiUsage } from '../usage';
import { ExtractionError } from './error';
import { fitPageImage, type ModelImage } from './page-image';
import { ExtractedPage, type ExtractedPageData } from './schema';

export type PageImage = {
  // The photo as uploaded; it is fitted to the model's image limits here.
  readonly image: Uint8Array;
  readonly targetLanguage: string;
};

export const extractionPrompt = (targetLanguage: string): string =>
  [
    `Extract this German school textbook vocabulary page for ${targetLanguage} in reading order.`,
    'Copy every target entry, German translation and example exactly, including accents.',
    'targetText is the bare term: omit pronunciation, labels like adj., m./f., pl., fam., irregular forms and conjugation hints like (o → ue) or (como tener).',
    'Keep printed alternatives (le fils / la fille) and constructions like + inf., qc or algo, but give a noun without its plural (el test, los tests → el test).',
    'nativeText is the translation alone, without conjugation notes or page references.',
    'Translate printed examples faithfully into German as exampleTranslation; invent none.',
    'Copy printed synonyms and opposites into synonyms and antonyms; invent none.',
    'Give entry and overall confidence from 0 to 1; lower it for unclear or cropped print.',
    'Report pageNumber and pageNumberConfidence only for a visible printed page number; never infer it.',
    'Include unitName only when a visible unit heading clearly applies.',
  ].join('\n');

export type ExtractionResult = {
  readonly page: ExtractedPageData;
  readonly modelId: string;
};

export class Extraction extends Context.Service<
  Extraction,
  {
    readonly extract: (
      input: PageImage,
    ) => Effect.Effect<ExtractionResult, ExtractionError, AiUsage>;
  }
>()('@wordhold/ai/Extraction') {
  static readonly layer = Layer.effect(
    Extraction,
    Effect.gen(function* () {
      const model = yield* BedrockProvider;
      const modelId = productionModelId;

      const runModel = (
        image: ModelImage,
        targetLanguage: string,
      ): Effect.Effect<ExtractedPageData, ExtractionError, AiUsage> =>
        generateStructured({
          model,
          operation: 'page-extraction',
          schema: ExtractedPage,
          prompt: [
            {
              role: 'user',
              content: [
                { type: 'file', data: image.data, mediaType: image.mediaType },
                { type: 'text', text: extractionPrompt(targetLanguage) },
              ],
            },
          ],
          failure: (cause) =>
            cause instanceof UnusableAnswerError
              ? new ExtractionError({
                  reason: 'invalidOutput',
                  message: `${modelId} answered outside the page schema.`,
                  cause,
                })
              : new ExtractionError({
                  reason: 'provider',
                  message: `The reading service rejected or did not answer the request for ${modelId}.`,
                  cause,
                }),
        });

      const extract = (
        input: PageImage,
      ): Effect.Effect<ExtractionResult, ExtractionError, AiUsage> =>
        fitPageImage(input.image).pipe(
          Effect.flatMap((image) => runModel(image, input.targetLanguage)),
          Effect.map((page) => ({ page, modelId })),
        );

      return Extraction.of({ extract });
    }),
  );
}
