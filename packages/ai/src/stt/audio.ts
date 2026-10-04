import type {
  AudioStream,
  TranscriptResultStream,
} from '@aws-sdk/client-transcribe-streaming';
import { Stream } from 'effect';
import type { AiCallUsage } from '../usage';

// Transcribe reads 16-bit little-endian PCM. AWS recommends 16 kHz for speech
// as the balance between quality and the data sent.
export const sttSampleRate = 16_000;
const bytesPerSample = 2;
export const sttBytesPerSecond = sttSampleRate * bytesPerSample;

// AWS recommends chunks of 50 to 200 ms.
const chunksPerSecond = 10;
const chunkBytes = sttBytesPerSecond / chunksPerSecond;

// A recording is sent whole once it is finished, so its chunks go out as
// fast as Transcribe takes them rather than at the pace they were spoken.
export const audioEvents = (audio: Uint8Array): AsyncIterable<AudioStream> =>
  Stream.toAsyncIterable(
    Stream.range(0, Math.ceil(audio.byteLength / chunkBytes) - 1).pipe(
      Stream.map((index) => ({
        AudioEvent: {
          AudioChunk: audio.subarray(
            index * chunkBytes,
            (index + 1) * chunkBytes,
          ),
        },
      })),
    ),
  );

// Transcribe bills each stream by the second, rounded up.
export const audioUsage = (audio: Uint8Array): AiCallUsage => {
  const seconds = audio.byteLength / sttBytesPerSecond;
  return {
    audioSeconds: Math.ceil(seconds),
    raw: { audioBytes: audio.byteLength, seconds },
  };
};

// Transcribe revises a segment while it listens and marks it final once the
// speaker pauses; only the final segments make up the transcript.
export const finalTranscript = async (
  results: AsyncIterable<TranscriptResultStream>,
): Promise<string> => {
  const segments: Array<string> = [];
  for await (const event of results) {
    for (const result of event.TranscriptEvent?.Transcript?.Results ?? []) {
      const segment = result.Alternatives?.[0]?.Transcript?.trim() ?? '';
      if (result.IsPartial === false && segment !== '') {
        segments.push(segment);
      }
    }
  }
  return segments.join(' ');
};
