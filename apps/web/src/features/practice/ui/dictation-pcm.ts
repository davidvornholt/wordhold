const bytesPerSample = 2;
const blockBytes = 65_536;
// 16-bit samples reach one step further below zero than above it.
const negativeScale = 0x80_00;
const positiveScale = 0x7f_ff;

export type PcmEncoder = {
  readonly push: (samples: Float32Array) => void;
  // The audio so far as one recording; the encoder is done afterwards.
  readonly finish: () => Uint8Array<ArrayBuffer>;
};

// A microphone records floats at the device's rate, usually 44.1 or 48 kHz,
// while speech recognition takes 16-bit little-endian mono PCM at its own
// rate. Each output sample averages the input samples it covers, which keeps
// sounds above the new rate from folding back as noise. Blocks arrive one
// after another, so the position carries over between them.
export const createPcmEncoder = (
  inputRate: number,
  outputRate: number,
): PcmEncoder => {
  const ratio = inputRate / outputRate;
  const blocks: Array<Uint8Array<ArrayBuffer>> = [];
  let block = new DataView(new ArrayBuffer(blockBytes));
  let filled = 0;
  let inputIndex = 0;
  let outputIndex = 0;
  let sum = 0;
  let count = 0;
  let previous = 0;

  const write = (value: number) => {
    if (filled === block.byteLength) {
      blocks.push(new Uint8Array(block.buffer));
      block = new DataView(new ArrayBuffer(blockBytes));
      filled = 0;
    }
    const clamped = Math.max(-1, Math.min(1, value));
    const scale = clamped < 0 ? negativeScale : positiveScale;
    block.setInt16(filled, Math.round(clamped * scale), true);
    filled += bytesPerSample;
  };

  // A device slower than the output rate repeats the last sample.
  const advanceTo = (target: number) => {
    while (outputIndex < target) {
      previous = count === 0 ? previous : sum / count;
      write(previous);
      sum = 0;
      count = 0;
      outputIndex += 1;
    }
  };

  return {
    push: (samples) => {
      for (const sample of samples) {
        advanceTo(Math.floor(inputIndex / ratio));
        sum += sample;
        count += 1;
        inputIndex += 1;
      }
    },
    finish: () => {
      if (count > 0) {
        advanceTo(outputIndex + 1);
      }
      blocks.push(new Uint8Array(block.buffer, 0, filled));
      const audio = new Uint8Array(
        blocks.reduce((total, part) => total + part.byteLength, 0),
      );
      let offset = 0;
      for (const part of blocks) {
        audio.set(part, offset);
        offset += part.byteLength;
      }
      return audio;
    },
  };
};
