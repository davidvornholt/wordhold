import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportDatabaseError } from '../errors/import-database-error';
import { UploadValidationError } from '../errors/upload-validation-error';
import {
  readRequestBodyWithinLimit,
  validateRequestContentLength,
} from './multipart';
import { ImportRepository } from './repository';
import { makeImportRepository, makeStorage } from './test-services';
import {
  maximumImageBytes,
  maximumImageWidth,
  maximumMultipartBytes,
  storeUploadedPage,
  validatePageImage,
} from './upload';

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const pngBytes = (): Uint8Array =>
  Uint8Array.from(atob(pngBase64), (character) => character.charCodeAt(0));
const pngWidthOffset = 16;
const invalidImageByteLength = 3;
const imageFile = (bytes: Uint8Array, type = 'application/octet-stream') =>
  new File([bytes.buffer as ArrayBuffer], 'page.bin', { type });

const runUpload = (
  image: File,
  repository = makeImportRepository(),
  storage = makeStorage(),
) =>
  Effect.runPromise(
    storeUploadedPage('course', image).pipe(
      Effect.provideService(ImportRepository, repository),
      Effect.provideService(Storage, storage),
    ),
  );

describe('upload limits', () => {
  it('rejects an oversized request before multipart parsing', () => {
    const request = new Request('http://wordhold.test/api/pages', {
      headers: { 'content-length': String(maximumMultipartBytes + 1) },
    });
    expect(() => validateRequestContentLength(request)).toThrow(
      UploadValidationError,
    );
  });

  it('stops a chunked request at the byte limit', async () => {
    const bodyLimit = 2;
    const request = new Request('http://wordhold.test/api/pages', {
      method: 'POST',
      body: new Uint8Array(bodyLimit + 1),
    });
    const error = await Effect.runPromise(
      Effect.flip(readRequestBodyWithinLimit(request, bodyLimit)),
    );
    expect(error).toBeInstanceOf(UploadValidationError);
  });
});

describe('validatePageImage', () => {
  it('uses the image bytes instead of the declared MIME type', async () => {
    const result = await Effect.runPromise(
      validatePageImage(imageFile(pngBytes(), 'text/plain')),
    );
    expect(result).toMatchObject({
      extension: 'png',
      mediaType: 'image/png',
      width: 1,
      height: 1,
    });
  });

  it('rejects File.size before reading oversized bytes', async () => {
    let read = false;
    const file = {
      size: maximumImageBytes + 1,
      arrayBuffer: () => {
        read = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
    } as File;
    const error = await Effect.runPromise(Effect.flip(validatePageImage(file)));
    expect(error).toBeInstanceOf(UploadValidationError);
    expect(read).toBe(false);
  });

  it('rejects dimensions over the explicit limit', async () => {
    const bytes = pngBytes();
    new DataView(bytes.buffer).setUint32(pngWidthOffset, maximumImageWidth + 1);
    await expect(
      Effect.runPromise(validatePageImage(imageFile(bytes))),
    ).rejects.toThrow('Abmessungen');
  });
});

describe('storeUploadedPage', () => {
  it('does not store rejected bytes', async () => {
    const actions: Array<string> = [];
    const storage = makeStorage({
      write: () => Effect.sync(() => actions.push('write')),
    });
    await expect(
      runUpload(
        imageFile(new Uint8Array(invalidImageByteLength)),
        undefined,
        storage,
      ),
    ).rejects.toThrow('JPEG-, PNG- oder WebP-Datei');
    expect(actions).toEqual([]);
  });

  it('removes the image when its page row cannot be inserted', async () => {
    const actions: Array<string> = [];
    const repository = makeImportRepository({
      insertPage: () =>
        Effect.sync(() => actions.push('insert')).pipe(
          Effect.zipRight(
            Effect.fail(
              new ImportDatabaseError({
                operation: 'insert page',
                cause: new Error('insert failed'),
                message: 'insert failed',
              }),
            ),
          ),
        ),
    });
    const storage = makeStorage({
      write: () => Effect.sync(() => actions.push('write')),
      remove: () => Effect.sync(() => actions.push('remove')),
    });
    await expect(
      runUpload(imageFile(pngBytes()), repository, storage),
    ).rejects.toThrow('insert failed');
    expect(actions).toEqual(['write', 'insert', 'remove']);
  });
});
