import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Effect, Redacted } from 'effect';
import { awsAccessKeyId, awsRegion, awsSecretAccessKey } from '../config';
import { TtsError } from './error';

// One neural voice per language; swapping the TTS provider later only means
// replacing this service implementation.
const voices: Record<string, string> = {
  de: 'Vicki',
  en: 'Amy',
  es: 'Lucia',
  fr: 'Lea',
};

export type TtsRequest = {
  readonly text: string;
  readonly language: 'de' | 'en' | 'es' | 'fr';
};

export type TtsResult = {
  readonly audio: Uint8Array;
  readonly voice: string;
};

export class Tts extends Effect.Service<Tts>()('@wordhold/ai/Tts', {
  effect: Effect.gen(function* () {
    const region = yield* awsRegion;
    const accessKeyId = Redacted.value(yield* awsAccessKeyId);
    const secretAccessKey = Redacted.value(yield* awsSecretAccessKey);
    const client = new PollyClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const synthesize = (
      request: TtsRequest,
    ): Effect.Effect<TtsResult, TtsError> =>
      Effect.gen(function* () {
        const voice = voices[request.language];
        if (voice === undefined) {
          return yield* new TtsError({
            cause: `No voice configured for language ${request.language}`,
          });
        }
        const audio = yield* Effect.tryPromise({
          try: async () => {
            const response = await client.send(
              new SynthesizeSpeechCommand({
                Engine: 'neural',
                OutputFormat: 'mp3',
                Text: request.text,
                VoiceId: voice as never,
              }),
            );
            if (response.AudioStream === undefined) {
              throw new Error('Polly returned no audio stream');
            }
            return await response.AudioStream.transformToByteArray();
          },
          catch: (cause) => new TtsError({ cause }),
        });
        return { audio, voice };
      });

    return { synthesize } as const;
  }),
}) {}
