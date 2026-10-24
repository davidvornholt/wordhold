import { Context, Effect, Layer } from 'effect';
import { ExtractionError } from '../extraction/error';
import {
  fitPageImage,
  type ModelImage,
  type QuarterTurn,
  turnModelImage,
} from '../extraction/page-image';
import { BedrockProvider, productionModelId } from '../providers/bedrock';
import { generateStructured } from '../structured-generation';
import { UnusableAnswerError } from '../unusable-answer-error';
import type { AiUsage } from '../usage';
import { NotesPage, type NotesPageData, type TextTopData } from './schema';

export const notesPrompt = [
  'Extract the technical terms and their definitions from these German school notes in reading order.',
  'The photo may be handwritten or printed and may be turned sideways or upside down.',
  'Report textTop as the side of the photo that the tops of the letters point to: up when the photo is upright, right when the lines run from top to bottom.',
  'Copy each term and its definition exactly as written, letter by letter; keep the grammatical number and form of the term, and invent no definitions or added knowledge.',
  'term is the bare term without a trailing colon. definition is everything written for it, joined into one text.',
  'A list or table that pairs names with a value, such as a substance with its formula, gives one term per row with the value as its definition.',
  'Skip headings, dates and page labels that define nothing.',
  'Write chemical indices and charges as Unicode subscript and superscript characters (CH₄, SO₄²⁻, CₙH₂ₙ₊₂) when the notes lower or raise them; keep a letter without a subscript character, like y, on the line.',
  'Give each term a confidence from 0 to 1; lower it for unclear handwriting or cut-off text.',
].join('\n');

// The clockwise turn that brings each side of the photo to the top.
const uprightTurns: Record<TextTopData, QuarterTurn> = {
  up: 0,
  right: 270,
  down: 180,
  left: 90,
};

export type NotesResult = {
  readonly notes: NotesPageData;
  readonly modelId: string;
  // How far the photo was turned clockwise to be read upright.
  readonly turned: QuarterTurn;
};

export class NotesExtraction extends Context.Service<
  NotesExtraction,
  {
    readonly extract: (
      image: Uint8Array,
    ) => Effect.Effect<NotesResult, ExtractionError, AiUsage>;
  }
>()('@wordhold/ai/NotesExtraction') {
  static readonly layer = Layer.effect(
    NotesExtraction,
    Effect.gen(function* () {
      const model = yield* BedrockProvider;
      const modelId = productionModelId;

      const read = (
        image: ModelImage,
      ): Effect.Effect<NotesPageData, ExtractionError, AiUsage> =>
        generateStructured({
          model,
          operation: 'notes-extraction',
          schema: NotesPage,
          prompt: [
            {
              role: 'user',
              content: [
                { type: 'file', data: image.data, mediaType: image.mediaType },
                { type: 'text', text: notesPrompt },
              ],
            },
          ],
          failure: (cause) =>
            cause instanceof UnusableAnswerError
              ? new ExtractionError({
                  reason: 'invalidOutput',
                  message: `${modelId} answered outside the notes schema.`,
                  cause,
                })
              : new ExtractionError({
                  reason: 'provider',
                  message: `The reading service rejected or did not answer the request for ${modelId}.`,
                  cause,
                }),
        });

      // Sideways handwriting is misread more often, such as a singular term
      // read as its plural, so a turned photo is read again upright. The
      // second reading counts only when it confirms the photo is upright now.
      const extract = (
        image: Uint8Array,
      ): Effect.Effect<NotesResult, ExtractionError, AiUsage> =>
        Effect.gen(function* () {
          const fitted = yield* fitPageImage(image);
          const notes = yield* read(fitted);
          const turn = uprightTurns[notes.textTop];
          if (turn === 0) {
            return { notes, modelId, turned: 0 } as const;
          }
          const upright = yield* read(yield* turnModelImage(fitted, turn));
          return upright.textTop === 'up'
            ? { notes: upright, modelId, turned: turn }
            : { notes, modelId, turned: 0 as const };
        });

      return NotesExtraction.of({ extract });
    }),
  );
}
