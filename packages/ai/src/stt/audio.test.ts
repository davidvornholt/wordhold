import { describe, expect, it } from 'bun:test';
import type { TranscriptResultStream } from '@aws-sdk/client-transcribe-streaming';
import { Stream } from 'effect';
import {
  audioEvents,
  audioUsage,
  finalTranscript,
  sttBytesPerSecond,
} from './audio';

const collect = async <A>(iterable: AsyncIterable<A>) => {
  const items: Array<A> = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
};

const segment = (
  transcript: string,
  isPartial: boolean,
): TranscriptResultStream => ({
  TranscriptEvent: {
    Transcript: {
      Results: [
        { IsPartial: isPartial, Alternatives: [{ Transcript: transcript }] },
      ],
    },
  },
});

const stream = (events: ReadonlyArray<TranscriptResultStream>) =>
  Stream.toAsyncIterable(Stream.fromIterable(events));

describe('audioEvents', () => {
  it('sends the recording in chunks of a tenth of a second', async () => {
    expect(await collect(audioEvents(new Uint8Array(0)))).toEqual([]);
    const audio = new Uint8Array(sttBytesPerSecond / 4);
    const chunks = (await collect(audioEvents(audio))).map(
      (event) => event.AudioEvent?.AudioChunk?.byteLength,
    );
    expect(chunks).toEqual([3200, 3200, 1600]);
  });
});

describe('audioUsage', () => {
  it('bills every second begun', () => {
    expect(audioUsage(new Uint8Array(sttBytesPerSecond * 2 + 2))).toEqual({
      audioSeconds: 3,
      raw: { audioBytes: sttBytesPerSecond * 2 + 2, seconds: 2.000_062_5 },
    });
  });
});

describe('finalTranscript', () => {
  it('joins the final segments and leaves out the drafts before them', async () => {
    expect(
      await finalTranscript(
        stream([
          segment('Der Herr', true),
          segment('Der Herr ist mein Hirte.', false),
          { TranscriptEvent: { Transcript: { Results: [] } } },
          segment(' Mir wird nichts mangeln. ', false),
        ]),
      ),
    ).toBe('Der Herr ist mein Hirte. Mir wird nichts mangeln.');
  });

  it('is empty when nothing was said', async () => {
    expect(await finalTranscript(stream([segment('', false)]))).toBe('');
  });
});
