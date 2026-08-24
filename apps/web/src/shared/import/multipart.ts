import { maximumMultipartBytes, UploadValidationError } from './upload';

const badRequestStatus = 400;
const contentTooLargeStatus = 413;
const unsignedInteger = /^\d+$/u;

export const validateRequestContentLength = (request: Request): void => {
  const value = request.headers.get('content-length');
  if (value === null) {
    return;
  }
  if (!unsignedInteger.test(value)) {
    throw new UploadValidationError(
      'Ungültige Upload-Größe.',
      badRequestStatus,
    );
  }
  if (BigInt(value) > BigInt(maximumMultipartBytes)) {
    throw new UploadValidationError(
      'Das Bild ist größer als 12 MiB.',
      contentTooLargeStatus,
    );
  }
};

export const readRequestBodyWithinLimit = async (
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> => {
  if (request.body === null) {
    throw new UploadValidationError(
      'Der Upload enthält keine Daten.',
      badRequestStatus,
    );
  }
  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let totalBytes = 0;
  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        // biome-ignore lint/performance/noAwaitInLoops: cancellation stops an oversized request before multipart parsing
        await reader.cancel();
        throw new UploadValidationError(
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
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export const parseBoundedMultipartFormData = async (
  request: Request,
): Promise<FormData> => {
  validateRequestContentLength(request);
  const contentType = request.headers.get('content-type');
  if (contentType === null || !contentType.startsWith('multipart/form-data;')) {
    throw new UploadValidationError(
      'Der Upload muss multipart/form-data verwenden.',
      badRequestStatus,
    );
  }
  const bytes = await readRequestBodyWithinLimit(
    request,
    maximumMultipartBytes,
  );
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { 'content-type': contentType },
  }).formData();
};
