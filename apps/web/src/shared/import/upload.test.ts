import { describe, expect, it } from 'bun:test';
import {
  readRequestBodyWithinLimit,
  validateRequestContentLength,
} from './multipart';
import {
  createUploadedPage,
  maximumImageBytes,
  maximumImageWidth,
  maximumMultipartBytes,
  UploadValidationError,
  validatePageImage,
} from './upload';

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const pngBytes = (): Uint8Array =>
  Uint8Array.from(atob(pngBase64), (character) => character.charCodeAt(0));
const pageId = 'd9428888-122b-41e1-b85c-61cd3cbb3210';
const pngWidthOffset = 16;
const invalidImageByteLength = 3;
const invalidImageBytes = new Uint8Array(invalidImageByteLength);

const imageFile = (bytes: Uint8Array, type = 'application/octet-stream') =>
  new File([bytes.buffer as ArrayBuffer], 'page.bin', { type });

const dependencies = (actions: Array<string>) => ({
  findCourse: () =>
    Promise.resolve({ id: 'course', targetLanguage: 'fr' as const }),
  newPageId: () => pageId,
  reconcile: () => Promise.resolve(),
  writeFile: () => {
    actions.push('write');
    return Promise.resolve();
  },
  removeFile: () => {
    actions.push('remove');
    return Promise.resolve();
  },
  insertPage: () => {
    actions.push('insert');
    return Promise.resolve();
  },
  extract: () => {
    actions.push('extract');
    return Promise.resolve({
      modelId: 'test-model',
      page: { entries: [], overallConfidence: 1 },
    });
  },
  updateExtraction: () => Promise.resolve(true),
  toBase64: () => 'encoded',
});

describe('validateRequestContentLength', () => {
  it('rejects an oversized request before multipart parsing', () => {
    const request = new Request('http://wordhold.test/api/pages', {
      headers: { 'content-length': String(maximumMultipartBytes + 1) },
    });
    expect(() => validateRequestContentLength(request)).toThrow(
      UploadValidationError,
    );
  });
});

describe('readRequestBodyWithinLimit', () => {
  it('stops a chunked request at the byte limit', async () => {
    const bodyLimit = 2;
    const request = new Request('http://wordhold.test/api/pages', {
      method: 'POST',
      body: new Uint8Array(bodyLimit + 1),
    });
    await expect(
      readRequestBodyWithinLimit(request, bodyLimit),
    ).rejects.toThrow(UploadValidationError);
  });
});

describe('validatePageImage', () => {
  it('uses the image bytes instead of the declared MIME type', async () => {
    const result = await validatePageImage(imageFile(pngBytes(), 'text/plain'));
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
    await expect(validatePageImage(file)).rejects.toThrow(
      UploadValidationError,
    );
    expect(read).toBe(false);
  });

  it('rejects dimensions over the explicit limit', async () => {
    const bytes = pngBytes();
    const view = new DataView(bytes.buffer);
    view.setUint32(pngWidthOffset, maximumImageWidth + 1);
    await expect(validatePageImage(imageFile(bytes))).rejects.toThrow(
      'Abmessungen',
    );
  });
});

describe('createUploadedPage', () => {
  it('sends rejected bytes to neither storage nor extraction', async () => {
    const actions: Array<string> = [];
    await expect(
      createUploadedPage(
        'course',
        imageFile(invalidImageBytes),
        dependencies(actions),
      ),
    ).rejects.toThrow(UploadValidationError);
    expect(actions).toEqual([]);
  });

  it('removes the image when its page row cannot be inserted', async () => {
    const actions: Array<string> = [];
    const configured = dependencies(actions);
    await expect(
      createUploadedPage('course', imageFile(pngBytes()), {
        ...configured,
        insertPage: () => {
          actions.push('insert');
          return Promise.reject(new Error('insert failed'));
        },
      }),
    ).rejects.toThrow('insert failed');
    expect(actions).toEqual(['write', 'insert', 'remove']);
  });
});
