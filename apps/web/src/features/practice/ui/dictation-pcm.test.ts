import { describe, expect, it } from 'bun:test';
import { createPcmEncoder } from './dictation-pcm';

const samplesOf = (audio: Uint8Array): Array<number> => {
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  return Array.from({ length: audio.byteLength / 2 }, (_, index) =>
    view.getInt16(index * 2, true),
  );
};

const encode = (
  inputRate: number,
  outputRate: number,
  blocks: Array<Array<number>>,
): Array<number> => {
  const encoder = createPcmEncoder(inputRate, outputRate);
  for (const block of blocks) {
    encoder.push(Float32Array.from(block));
  }
  return samplesOf(encoder.finish());
};

describe('createPcmEncoder', () => {
  it('averages the samples each output sample covers', () => {
    expect(
      encode(48_000, 16_000, [[0.25, 0.25, 0.25, -0.5, -0.5, -0.5]]),
    ).toEqual([8192, -16_384]);
  });

  it('clamps sounds louder than full scale', () => {
    expect(encode(16_000, 16_000, [[2, -2, 1, -1]])).toEqual([
      32_767, -32_768, 32_767, -32_768,
    ]);
  });

  it('keeps its place across blocks at a rate that does not divide evenly', () => {
    const seconds = 3;
    const recording = Array.from({ length: 44_100 * seconds }, () => 0.5);
    const blocks = Array.from(
      { length: Math.ceil(recording.length / 128) },
      (_, index) => recording.slice(index * 128, (index + 1) * 128),
    );

    const samples = encode(44_100, 16_000, blocks);

    expect(samples).toHaveLength(16_000 * seconds);
    expect(new Set(samples)).toEqual(new Set([16_384]));
  });

  it('repeats samples for a device slower than the output rate', () => {
    expect(encode(8000, 16_000, [[0.5, -0.5]])).toEqual([
      16_384, 16_384, -16_384,
    ]);
  });

  it('returns no audio for a recording without samples', () => {
    expect(encode(48_000, 16_000, [])).toEqual([]);
  });
});
