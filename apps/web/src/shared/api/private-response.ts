/**
 * Every API answer is one person's vocabulary, so no cache may keep it, and
 * a browser may not guess its type.
 */
export const applyPrivateResponseHeaders = (
  headers: Pick<Headers, 'set'>,
): void => {
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('x-content-type-options', 'nosniff');
};
