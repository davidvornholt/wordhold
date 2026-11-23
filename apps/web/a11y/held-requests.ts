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
  Reflect.set(globalThis, '__releaseHeldRequests', () => {
    for (const release of held.splice(0)) {
      release();
    }
  });
  return new Promise((resolve) => {
    held.push(() => resolve(settle()));
  });
};

// For a test to run in the page with `page.evaluate`, which sends only the
// function's source, so it names the release instead of sharing a constant.
export const releaseHeldRequests = () =>
  Reflect.get(globalThis, '__releaseHeldRequests')();
