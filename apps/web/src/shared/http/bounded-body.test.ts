import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { type BodyLimit, readBoundedBody } from './bounded-body';

const limit: BodyLimit = {
  maximumBytes: 4,
  messages: {
    lengthMissing: 'length missing',
    tooLarge: 'too large',
    empty: 'empty',
    unreadable: 'unreadable',
  },
};

// A browser states the length of a body it has in memory; Bun's Request
// leaves that to the moment it is sent.
const post = (
  body: Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) =>
  new Request('http://localhost/upload', {
    method: 'POST',
    body,
    headers:
      body instanceof Uint8Array
        ? { 'content-length': String(body.byteLength), ...headers }
        : headers,
  });

const read = (request: Request) =>
  Effect.runPromise(Effect.result(readBoundedBody(request, limit)));

describe('readBoundedBody', () => {
  it('reads a body within the limit', async () => {
    const result = await read(post(new Uint8Array([1, 2, 3])));
    expect(result).toMatchObject({ _tag: 'Success' });
    expect(Array.from(result._tag === 'Success' ? result.success : [])).toEqual(
      [1, 2, 3],
    );
  });

  it('refuses a body whose stated length is over the limit before reading it', async () => {
    expect(await read(post(new Uint8Array(5)))).toMatchObject({
      _tag: 'Failure',
      failure: { message: 'too large', status: 413 },
    });
  });

  it('cuts off a body that grows past its stated length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new Uint8Array(3));
        controller.enqueue(new Uint8Array(3));
        controller.close();
      },
    });
    expect(await read(post(stream, { 'content-length': '3' }))).toMatchObject({
      _tag: 'Failure',
      failure: { status: 413 },
    });
  });

  it('asks for a length and refuses an empty body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => controller.close(),
    });
    expect(await read(post(stream))).toMatchObject({
      _tag: 'Failure',
      failure: { message: 'length missing', status: 411 },
    });
    expect(await read(post(new Uint8Array(0)))).toMatchObject({
      _tag: 'Failure',
      failure: { message: 'empty', status: 400 },
    });
  });
});
