import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { BedrockProvider } from '../providers/bedrock';
import { capturedBedrockModel } from '../testing/bedrock';
import { untrackedAiUsage } from '../testing/usage';
import type { NotesPageData } from './schema';
import { NotesExtraction } from './service';

const onePixelPng = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

// A landscape photo of a portrait page, as a phone held sideways takes it.
const landscapePhoto = () =>
  new globalThis.Bun.Image(onePixelPng).resize(400, 300).jpeg().bytes();

const reading = (
  textTop: NotesPageData['textTop'],
  term: string,
): NotesPageData => ({
  textTop,
  terms: [
    {
      term,
      definition: 'Organische Verbindung mit der Summenformel CnH2n+2',
      confidence: 0.9,
    },
  ],
});

type ConverseImage = {
  readonly image: { readonly source: { readonly bytes: string } };
};

// The size of the image each request sent, in request order.
const sentImageSizes = (
  calls: ReturnType<typeof capturedBedrockModel>['calls'],
) =>
  Promise.all(
    calls.map(async (call) => {
      const [message] = call.body.messages as ReadonlyArray<{
        readonly content: ReadonlyArray<ConverseImage>;
      }>;
      const bytes = message?.content[0]?.image.source.bytes ?? '';
      const { width, height } = await new globalThis.Bun.Image(
        Uint8Array.fromBase64(bytes),
      ).metadata();
      return { width, height };
    }),
  );

const extract = async (...answers: ReadonlyArray<NotesPageData>) => {
  const { calls, model } = capturedBedrockModel(...answers);
  const photo = await landscapePhoto();
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* NotesExtraction).extract(photo);
    }).pipe(
      Effect.provide(
        NotesExtraction.layer.pipe(
          Layer.provide(Layer.succeed(BedrockProvider, model)),
          Layer.merge(untrackedAiUsage),
        ),
      ),
    ),
  );
  return { calls, result };
};

describe('NotesExtraction', () => {
  it('reads an upright photo once', async () => {
    const { calls, result } = await extract(reading('up', 'Alkan'));

    expect(calls).toHaveLength(1);
    expect(result.turned).toBe(0);
    expect(result.notes.terms.map((term) => term.term)).toEqual(['Alkan']);
  });

  it('reads a sideways photo again after turning it upright', async () => {
    const { calls, result } = await extract(
      reading('right', 'Alkane'),
      reading('up', 'Alkan'),
    );

    expect(result.turned).toBe(270);
    expect(result.notes.terms.map((term) => term.term)).toEqual(['Alkan']);
    expect(await sentImageSizes(calls)).toEqual([
      { width: 400, height: 300 },
      { width: 300, height: 400 },
    ]);
  });

  it('keeps the first reading when the turned photo is not upright either', async () => {
    const { calls, result } = await extract(
      reading('right', 'Alkane'),
      reading('left', 'Alkan'),
    );

    expect(calls).toHaveLength(2);
    expect(result.turned).toBe(0);
    expect(result.notes.terms.map((term) => term.term)).toEqual(['Alkane']);
  });
});
