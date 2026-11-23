// Where the fixture page keeps the function that releases its held requests,
// for a test to call through `page.evaluate`.
export const releaseHeldRequestsKey = '__releaseHeldRequests';

const held: Array<() => void> = [];

// With `?hold=<request>` in the address, that request settles only when the
// test releases it, so the test can act while it is pending.
export const settleRequest = <T>(
  request: string,
  settle: () => T,
): Promise<T> => {
  if (new URLSearchParams(globalThis.location.search).get('hold') !== request) {
    return Promise.resolve(settle());
  }
  Reflect.set(globalThis, releaseHeldRequestsKey, () => {
    for (const release of held.splice(0)) {
      release();
    }
  });
  return new Promise((resolve) => {
    held.push(() => resolve(settle()));
  });
};
