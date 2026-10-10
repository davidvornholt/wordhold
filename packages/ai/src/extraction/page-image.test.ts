import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { fitPageImage } from './page-image';

const onePixelPng = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

const source = (width: number, height: number) =>
  new globalThis.Bun.Image(onePixelPng).resize(width, height);

const dimensions = (image: Uint8Array) =>
  new globalThis.Bun.Image(image).metadata();

// A Pixel motion photo is a JPEG followed by the MP4 of its short video.
const withTrailingVideo = (jpeg: Uint8Array): Uint8Array => {
  const video = new Uint8Array(1024 * 1024);
  video.set(new TextEncoder().encode('\0\0\0\x18ftypmp42'));
  const photo = new Uint8Array(jpeg.length + video.length);
  photo.set(jpeg);
  photo.set(video, jpeg.length);
  return photo;
};

describe('fitPageImage', () => {
  it('shrinks a motion photo to the long edge the model reads', async () => {
    const photo = withTrailingVideo(
      await source(3072, 4080).jpeg({ quality: 95 }).bytes(),
    );

    const fitted = await Effect.runPromise(fitPageImage(photo));

    expect(fitted.mediaType).toBe('image/jpeg');
    expect(await dimensions(fitted.data)).toEqual({
      width: 1940,
      height: 2576,
      format: 'jpeg',
    });
    expect(fitted.data.length).toBeLessThan(photo.length);
  });

  it('keeps a small screenshot at its size, as a WebP that can hold transparency', async () => {
    const screenshot = await source(800, 600).png().bytes();

    const fitted = await Effect.runPromise(fitPageImage(screenshot));

    expect(fitted.mediaType).toBe('image/webp');
    expect(await dimensions(fitted.data)).toEqual({
      width: 800,
      height: 600,
      format: 'webp',
    });
  });

  it('reports bytes that are not an image as an unreadable photo', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(fitPageImage(new TextEncoder().encode('not an image'))),
    );

    expect(failure.reason).toBe('unreadableImage');
  });
});
