import { Stt } from '@wordhold/ai/stt';
import { sttBytesPerSecond } from '@wordhold/ai/stt/audio';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { MemberRepositoryLive } from '../../../shared/auth/member-repository';
import {
  RequestBodyError,
  readBoundedBody,
} from '../../../shared/http/bounded-body';
import {
  dictationContentType,
  maximumDictationSeconds,
} from '../schemas/dictation';

const badRequestStatus = 400;
const unsupportedMediaTypeStatus = 415;
// One second more than the recorder allows, for the moment stopping takes.
const maximumAudioBytes = (maximumDictationSeconds + 1) * sttBytesPerSecond;
const bytesPerSample = 2;

export const readDictation = (
  request: Request,
): Effect.Effect<Uint8Array, RequestBodyError> =>
  Effect.gen(function* () {
    if (request.headers.get('content-type') !== dictationContentType) {
      return yield* new RequestBodyError({
        message: 'Die Aufnahme hat ein unbekanntes Format.',
        status: unsupportedMediaTypeStatus,
      });
    }
    const audio = yield* readBoundedBody(request, {
      maximumBytes: maximumAudioBytes,
      messages: {
        lengthMissing: 'Die Länge der Aufnahme fehlt.',
        tooLarge: `Die Aufnahme ist länger als ${maximumDictationSeconds / 60} Minuten.`,
        empty: 'Die Aufnahme ist leer.',
        unreadable: 'Die Aufnahme konnte nicht empfangen werden.',
      },
    });
    if (audio.byteLength % bytesPerSample !== 0) {
      return yield* new RequestBodyError({
        message: 'Die Aufnahme ist unvollständig.',
        status: badRequestStatus,
      });
    }
    return audio;
  });

// The person who spoke pays for the recognition.
export const transcribeDictation = (userId: string, audio: Uint8Array) =>
  Effect.flatMap(Stt, (stt) => stt.transcribe({ audio })).pipe(
    billedTo(userId),
    Effect.map(({ transcript }) => transcript),
  );

// The route checks the member itself, so the member repository is in the
// runtime as well.
export const dictationRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    Stt.Default,
    UsageLedger.live(PgLive),
    MemberRepositoryLive.pipe(Layer.provide(PgLive)),
  ),
);
