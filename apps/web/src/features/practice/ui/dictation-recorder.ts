import {
  dictationSampleRate,
  maximumDictationSeconds,
} from '../schemas/dictation';
import { createPcmEncoder } from './dictation-pcm';

// Runs on the audio thread and passes each block of microphone samples to the
// page. The engine reuses its buffers, so every block is copied.
const processorName = 'wordhold-dictation';
const processorSource = `registerProcessor('${processorName}', class extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel !== undefined) {
      this.port.postMessage(channel.slice());
    }
    return true;
  }
});`;

export type Recording = {
  // Ends the recording and returns its audio for recognition.
  readonly stop: () => Uint8Array<ArrayBuffer>;
  // Ends the recording and drops its audio.
  readonly cancel: () => void;
};

export const dictationSupported = (): boolean =>
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof AudioWorkletNode === 'function';

const loadProcessor = async (context: AudioContext) => {
  const url = URL.createObjectURL(
    new Blob([processorSource], { type: 'text/javascript' }),
  );
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Records the microphone until stopped. Rejects with the browser's
// DOMException when the microphone is not allowed or not there.
export const startRecording = async (): Promise<Recording> => {
  // Created before the first await, so Safari counts it as started by the
  // tap and lets it play.
  const context = new AudioContext();
  let stream: MediaStream | null = null;
  const release = () => {
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }
    context.close().catch(() => undefined);
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    await loadProcessor(context);
    const encoder = createPcmEncoder(context.sampleRate, dictationSampleRate);
    const processor = new AudioWorkletNode(context, processorName);
    // The page stops the recording at its limit, but a hidden tab may run
    // its timer late, so audio past the limit is dropped here.
    const sampleLimit = maximumDictationSeconds * context.sampleRate;
    let recorded = 0;
    processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (recorded < sampleLimit) {
        encoder.push(event.data);
        recorded += event.data.length;
      }
    };
    context.createMediaStreamSource(stream).connect(processor);
    // Some browsers only run nodes that lead to the speakers. The processor
    // writes nothing, so they stay silent.
    processor.connect(context.destination);
    await context.resume();
    const end = () => {
      processor.port.onmessage = null;
      release();
    };
    return {
      stop: () => {
        end();
        return encoder.finish();
      },
      cancel: end,
    };
  } catch (error) {
    release();
    throw error;
  }
};
