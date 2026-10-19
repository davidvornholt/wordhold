import { Effect } from 'effect';
import { ExtractionError } from './error';

// Claude reads at most 2576 px on the long edge and rejects an image over
// 5 MB once base64-encoded. Phone photos exceed both: a Pixel motion photo
// carries a short video after the JPEG data. Every page is re-encoded to fit,
// which also drops the video and the metadata.
const longEdge = 2576;
const quality = 85;

export type ModelImage = {
  readonly data: Uint8Array;
  readonly mediaType: 'image/jpeg' | 'image/webp';
};

// A JPEG has no transparency and stays a JPEG, the fastest encoding. A PNG or
// WebP may be a screenshot with a transparent background, which JPEG would
// turn black, so it becomes a WebP.
const encode = async (image: Uint8Array): Promise<ModelImage> => {
  const { format } = await new globalThis.Bun.Image(image).metadata();
  const resized = new globalThis.Bun.Image(image).resize(longEdge, longEdge, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  return format === 'jpeg'
    ? { data: await resized.jpeg({ quality }).bytes(), mediaType: 'image/jpeg' }
    : {
        data: await resized.webp({ quality }).bytes(),
        mediaType: 'image/webp',
      };
};

const unreadable = (cause: unknown) =>
  new ExtractionError({
    reason: 'unreadableImage',
    message: 'The page photo could not be decoded.',
    cause,
  });

export const fitPageImage = (image: Uint8Array) =>
  Effect.tryPromise({ try: () => encode(image), catch: unreadable });

// A clockwise turn in degrees.
export type QuarterTurn = 0 | 90 | 180 | 270;

export const turnModelImage = (image: ModelImage, turn: QuarterTurn) =>
  Effect.tryPromise({
    try: async (): Promise<ModelImage> => {
      const turned = new globalThis.Bun.Image(image.data).rotate(turn);
      return {
        data:
          image.mediaType === 'image/jpeg'
            ? await turned.jpeg({ quality }).bytes()
            : await turned.webp({ quality }).bytes(),
        mediaType: image.mediaType,
      };
    },
    catch: unreadable,
  });

// The stored photo turned the same way, kept in its own format at its own
// size so it still matches its file name. JPEG and WebP are encoded again
// at a quality that keeps handwriting sharp.
const storedQuality = 92;

export const turnStoredPhoto = (photo: Uint8Array, turn: QuarterTurn) =>
  Effect.tryPromise({
    try: async (): Promise<Uint8Array> => {
      const { format } = await new globalThis.Bun.Image(photo).metadata();
      const turned = new globalThis.Bun.Image(photo).rotate(turn);
      switch (format) {
        case 'jpeg':
          return await turned.jpeg({ quality: storedQuality }).bytes();
        case 'png':
          return await turned.png().bytes();
        case 'webp':
          return await turned.webp({ quality: storedQuality }).bytes();
        default:
          throw new Error(`Unsupported stored photo format: ${format}.`);
      }
    },
    catch: unreadable,
  });
