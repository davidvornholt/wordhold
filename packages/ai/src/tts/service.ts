import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Effect, Redacted } from 'effect';
import { awsAccessKeyId, awsRegion, awsSecretAccessKey } from '../config';
import { type AiUsage, metered } from '../usage';
import { AiUsageError } from '../usage-error';
import { TtsError } from './error';
import { prepareSpeechText, type TtsLanguage } from './speech-text';

export type TtsRequest = {
  readonly text: string;
  readonly language: TtsLanguage;
};

export type TtsResult = {
  readonly audio: Uint8Array;
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
    ): Effect.Effect<TtsResult, TtsError, AiUsage> =>
      Effect.gen(function* () {
        const prepared = prepareSpeechText(request.text, request.language);
        const audio = yield* metered(
          { operation: 'speech', provider: 'polly', model: prepared.engine },
          (report) =>
            Effect.tryPromise({
              try: async () => {
                const response = await client.send(
                  new SynthesizeSpeechCommand({
                    Engine: prepared.engine,
                    LanguageCode: prepared.languageCode,
                    OutputFormat: 'mp3',
                    SampleRate: '24000',
                    Text: prepared.text,
                    TextType: prepared.textType,
                    VoiceId: prepared.voice,
                  }),
                );
                // Polly bills the characters it reports, SSML tags excluded.
                report(
                  response.RequestCharacters === undefined
                    ? { raw: { requestCharacters: null } }
                    : {
                        characters: response.RequestCharacters,
                        raw: { requestCharacters: response.RequestCharacters },
                      },
                );
                if (response.AudioStream === undefined) {
                  throw new Error('Polly returned no audio stream');
                }
                return await response.AudioStream.transformToByteArray();
              },
              catch: (cause) => new TtsError({ cause }),
            }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof AiUsageError
              ? new TtsError({ cause: error })
              : error,
          ),
        );
        return { audio };
      });

    return { synthesize } as const;
  }),
}) {}
