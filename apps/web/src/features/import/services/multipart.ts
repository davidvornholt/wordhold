import { Effect } from 'effect';
import { UploadReadError } from '../errors/upload-read-error';
import { UploadValidationError } from '../errors/upload-validation-error';
import { maximumMultipartBytes } from './upload';

const badRequestStatus = 400;
const contentTooLargeStatus = 413;
const unsignedInteger = /^\d+$/u;

const invalidUpload = (message: string, status = badRequestStatus) =>
  new UploadValidationError({ message, status });

export const validateRequestContentLength = (request: Request): void => {
  const value = request.headers.get('content-length');
  if (value === null) {
    return;
  }
  if (!unsignedInteger.test(value)) {
    throw invalidUpload('Ungültige Upload-Größe.');
  }
  if (BigInt(value) > BigInt(maximumMultipartBytes)) {
    throw invalidUpload(
      'Das Bild ist größer als 12 MiB.',
      contentTooLargeStatus,
    );
  }
};

export const readRequestBodyWithinLimit = (
  request: Request,
  maximumBytes: number,
): Effect.Effect<Uint8Array, UploadValidationError | UploadReadError> =>
  Effect.tryPromise({
    try: async () => {
      const reader = request.body?.getReader();
      if (reader === undefined) {
        throw invalidUpload('Der Upload enthält keine Daten.');
      }
      const chunks: Array<Uint8Array> = [];
      let totalBytes = 0;
      try {
        let chunk = await reader.read();
        while (!chunk.done) {
          totalBytes += chunk.value.byteLength;
          if (totalBytes > maximumBytes) {
            // biome-ignore lint/performance/noAwaitInLoops: cancellation must finish before the oversized stream is rejected
            await reader.cancel();
            throw invalidUpload(
              'Das Bild ist größer als 12 MiB.',
              contentTooLargeStatus,
            );
          }
          chunks.push(chunk.value);
          chunk = await reader.read();
        }
      } finally {
        reader.releaseLock();
      }
      const body = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return body;
    },
    catch: (cause) =>
      cause instanceof UploadValidationError
        ? cause
        : new UploadReadError({
            cause,
            message: 'Der Upload konnte nicht gelesen werden.',
          }),
  });

export const parseBoundedMultipartFormData = (
  request: Request,
): Effect.Effect<FormData, UploadValidationError | UploadReadError> =>
  Effect.gen(function* () {
    yield* Effect.try({
      try: () => validateRequestContentLength(request),
      catch: (cause) =>
        cause instanceof UploadValidationError
          ? cause
          : invalidUpload('Ungültige Upload-Größe.'),
    });
    const contentType = request.headers.get('content-type');
    if (
      contentType === null ||
      !contentType.startsWith('multipart/form-data;')
    ) {
      return yield* invalidUpload(
        'Der Upload muss multipart/form-data verwenden.',
      );
    }
    if (request.body === null) {
      return yield* invalidUpload('Der Upload enthält keine Daten.');
    }
    const bytes = yield* readRequestBodyWithinLimit(
      request,
      maximumMultipartBytes,
    );
    return yield* Effect.tryPromise({
      try: () =>
        new Response(bytes.buffer as ArrayBuffer, {
          headers: { 'content-type': contentType },
        }).formData(),
      catch: (cause) =>
        new UploadReadError({
          cause,
          message: 'Die Formulardaten sind ungültig.',
        }),
    });
  });
