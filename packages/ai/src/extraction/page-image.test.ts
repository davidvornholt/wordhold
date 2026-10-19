import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { fitPageImage, turnModelImage, turnStoredPhoto } from './page-image';

const onePixelPng = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

const source = (width: number, height: number) =>
  new globalThis.Bun.Image(onePixelPng).resize(width, height);

const dimensions = (image: Uint8Array) =>
  new globalThis.Bun.Image(image).metadata();

// Two pixels side by side: red on the left, blue on the right.
const redThenBluePng = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4AWP4z8DAwPAfAAcAAf8sMxIFAAAAAElFTkSuQmCC',
);

// The colour of a PNG's top-left pixel. Every PNG row filter leaves that
// pixel as stored, so it reads straight from the inflated image data.
const topLeftColour = (png: Uint8Array): 'red' | 'blue' | 'other' => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const data: Array<Uint8Array> = [];
  for (let offset = 8; offset < png.length; ) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    if (type === 'IDAT') {
      data.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const zlib = new Uint8Array(data.flatMap((part) => [...part]));
  // A zlib stream is a two-byte header, the deflate data and a checksum.
  const pixels = globalThis.Bun.inflateSync(zlib.subarray(2, -4));
  const [red, green, blue] = pixels.subarray(1, 4);
  if (red === 255 && green === 0 && blue === 0) {
    return 'red';
  }
  return red === 0 && green === 0 && blue === 255 ? 'blue' : 'other';
};

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

describe('turnModelImage', () => {
  it('turns a fitted image a quarter and keeps its encoding', async () => {
    const fitted = await Effect.runPromise(
      fitPageImage(await source(400, 300).jpeg().bytes()),
    );

    const turned = await Effect.runPromise(turnModelImage(fitted, 270));

    expect(turned.mediaType).toBe('image/jpeg');
    expect(await dimensions(turned.data)).toEqual({
      width: 300,
      height: 400,
      format: 'jpeg',
    });
  });
});

describe('turnStoredPhoto', () => {
  it('turns clockwise by the given angle', async () => {
    const turns = await Promise.all(
      ([90, 180, 270] as const).map(async (turn) =>
        topLeftColour(
          await Effect.runPromise(turnStoredPhoto(redThenBluePng, turn)),
        ),
      ),
    );

    // A clockwise quarter turn brings the left edge to the top.
    expect(turns).toEqual(['red', 'blue', 'blue']);
  });

  it('turns a stored photo in its own format', async () => {
    const photo = await source(400, 300).png().bytes();

    const turned = await Effect.runPromise(turnStoredPhoto(photo, 90));

    expect(await dimensions(turned)).toEqual({
      width: 300,
      height: 400,
      format: 'png',
    });
  });
});
