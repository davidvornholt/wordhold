import { Effect, Schema } from 'effect';

// A request body that cannot be accepted, with the HTTP status that says why.
export class RequestBodyError extends Schema.TaggedError<RequestBodyError>()(
  'RequestBodyError',
  {
    message: Schema.String,
    status: Schema.Number,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type BodyLimit = {
  readonly maximumBytes: number;
  // Each message names what the body is, such as a file or a recording.
  readonly messages: {
    readonly lengthMissing: string;
    readonly tooLarge: string;
    readonly empty: string;
    readonly unreadable: string;
  };
};

const badRequestStatus = 400;
const lengthRequiredStatus = 411;
const contentTooLargeStatus = 413;

const statedLength = /^\d+$/u;

// The stated length is checked before reading, and the body is cut off once
// it grows past the limit anyway, so a wrong length cannot get more through.
export const readBoundedBody = (
  request: Request,
  { maximumBytes, messages }: BodyLimit,
): Effect.Effect<Uint8Array, RequestBodyError> =>
  Effect.gen(function* () {
    const tooLarge = () =>
      new RequestBodyError({
        message: messages.tooLarge,
        status: contentTooLargeStatus,
      });
    const length = request.headers.get('content-length');
    if (length === null || !statedLength.test(length)) {
      return yield* new RequestBodyError({
        message: messages.lengthMissing,
        status: lengthRequiredStatus,
      });
    }
    if (Number(length) > maximumBytes) {
      return yield* tooLarge();
    }
    const reader = request.body?.getReader();
    if (reader === undefined || Number(length) === 0) {
      return yield* new RequestBodyError({
        message: messages.empty,
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
        cause instanceof RequestBodyError
          ? cause
          : new RequestBodyError({
              cause,
              message: messages.unreadable,
              status: badRequestStatus,
            }),
    });
  });
