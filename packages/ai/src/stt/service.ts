import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
} from '@aws-sdk/client-transcribe-streaming';
import { Duration, Effect, Redacted } from 'effect';
import { awsAccessKeyId, awsRegion, awsSecretAccessKey } from '../config';
import { type AiUsage, metered } from '../usage';
import { AiUsageError } from '../usage-error';
import {
  audioEvents,
  audioUsage,
  finalTranscript,
  sttSampleRate,
} from './audio';
import { SttError } from './error';

export type SttRequest = {
  // Mono 16-bit little-endian PCM at `sttSampleRate`.
  readonly audio: Uint8Array;
};

export type SttResult = {
  readonly transcript: string;
};

// Transcribe works through a recording several times faster than it was
// spoken, so the longest one finishes well within this.
const transcriptionMinutes = 3;
const transcriptionTimeout = Duration.minutes(transcriptionMinutes);

const failed = (cause: unknown) =>
  new SttError({
    cause,
    message:
      'Die Aufnahme konnte nicht in Text umgewandelt werden. Versuche es noch einmal.',
  });

// Speech to text for German, which is the language of every text learned by
// heart.
export class Stt extends Effect.Service<Stt>()('@wordhold/ai/Stt', {
  effect: Effect.gen(function* () {
    const region = yield* awsRegion;
    const accessKeyId = Redacted.value(yield* awsAccessKeyId);
    const secretAccessKey = Redacted.value(yield* awsSecretAccessKey);
    const client = new TranscribeStreamingClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const transcribe = (
      request: SttRequest,
    ): Effect.Effect<SttResult, SttError, AiUsage> =>
      metered(
        {
          operation: 'transcription',
          provider: 'transcribe',
          model: 'standard',
        },
        (report) =>
          Effect.tryPromise({
            try: async (signal) => {
              const response = await client.send(
                new StartStreamTranscriptionCommand({
                  LanguageCode: 'de-DE',
                  MediaEncoding: 'pcm',
                  MediaSampleRateHertz: sttSampleRate,
                  AudioStream: audioEvents(request.audio),
                }),
                { abortSignal: signal },
              );
              // The stream has started, so all of its audio is billed.
              report(audioUsage(request.audio));
              if (response.TranscriptResultStream === undefined) {
                throw new Error('Transcribe returned no transcript stream');
              }
              return {
                transcript: await finalTranscript(
                  response.TranscriptResultStream,
                ),
              };
            },
            catch: failed,
          }).pipe(
            Effect.timeoutFail({
              duration: transcriptionTimeout,
              onTimeout: () => failed('timed out'),
            }),
          ),
      ).pipe(
        Effect.mapError((error) =>
          error instanceof AiUsageError ? failed(error) : error,
        ),
      );

    return { transcribe } as const;
  }),
}) {}
