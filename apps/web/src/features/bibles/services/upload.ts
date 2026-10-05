import { Effect } from 'effect';
import { BibleUploadError } from '../errors/bible-errors';

const bytesPerKibibyte = 1024;
const kibibytesPerMebibyte = 1024;
// A German Bible module is about 6 MiB and one with Strong's numbers about
// 20 MiB, so 32 MiB leaves room without accepting anything.
const maximumModuleMebibytes = 32;
const maximumModuleBytes =
  maximumModuleMebibytes * kibibytesPerMebibyte * bytesPerKibibyte;

const badRequestStatus = 400;
const lengthRequiredStatus = 411;
const contentTooLargeStatus = 413;

const statedLength = /^\d+$/u;

const tooLarge = () =>
  new BibleUploadError({
    message: `Die Datei ist größer als ${maximumModuleMebibytes} MiB.`,
    status: contentTooLargeStatus,
  });

// The stated length is checked before reading, and the body is cut off once
// it grows past the limit anyway, so a wrong length cannot get more through.
export const readModuleUpload = (
  request: Request,
): Effect.Effect<Uint8Array, BibleUploadError> =>
  Effect.gen(function* () {
    const length = request.headers.get('content-length');
    if (length === null || !statedLength.test(length)) {
      return yield* new BibleUploadError({
        message: 'Die Größe der Datei fehlt.',
        status: lengthRequiredStatus,
      });
    }
    if (Number(length) > maximumModuleBytes) {
      return yield* tooLarge();
    }
    const reader = request.body?.getReader();
    if (reader === undefined || Number(length) === 0) {
      return yield* new BibleUploadError({
        message: 'Die Datei ist leer.',
        status: badRequestStatus,
      });
    }
    return yield* Effect.tryPromise({
      try: async () => {
        const body = new Uint8Array(Number(length));
        let received = 0;
        try {
          let chunk = await reader.read();
          while (!chunk.done) {
            if (received + chunk.value.byteLength > body.length) {
              // biome-ignore lint/performance/noAwaitInLoops: cancellation must finish before the oversized body is refused
              await reader.cancel();
              throw tooLarge();
            }
            body.set(chunk.value, received);
            received += chunk.value.byteLength;
            chunk = await reader.read();
          }
        } finally {
          reader.releaseLock();
        }
        return body.subarray(0, received);
      },
      catch: (cause) =>
        cause instanceof BibleUploadError
          ? cause
          : new BibleUploadError({
              cause,
              message: 'Die Datei konnte nicht empfangen werden.',
              status: badRequestStatus,
            }),
    });
  });
