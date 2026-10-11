// Why a server function call failed, as far as the browser can tell.
//
// TanStack Start rebuilds every error a server function throws as a plain
// Error that keeps only its message; no `_tag` or subclass arrives. Anything
// else went wrong on the way there:
// - fetch rejects with a TypeError when no connection could be made, and so
//   does a response body that breaks off.
// - While the app restarts, the reverse proxy answers in its place. Start's
//   client throws "Invariant failed" for a response without a Content-Type
//   (with a longer message in development), the body as the message for any
//   other non-JSON response (empty from Caddy, an HTML page or a status line
//   such as "502 Bad Gateway" elsewhere), and a SyntaxError for a JSON body it
//   cannot parse.
export type ServerFailure =
  | { readonly kind: 'network' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'reported'; readonly message: string };

const gatewayStatusLine =
  /^(?:\d{3}\s+)?(?:bad gateway|service unavailable|gateway time-?out)$/iu;

const messageOf = (cause: unknown): string =>
  typeof cause === 'object' &&
  cause !== null &&
  'message' in cause &&
  typeof cause.message === 'string'
    ? cause.message.trim()
    : '';

const isProxyMessage = (message: string): boolean =>
  message === '' ||
  message.startsWith('<') ||
  message.startsWith('Invariant failed') ||
  gatewayStatusLine.test(message);

export const classifyServerFailure = (cause: unknown): ServerFailure => {
  if (cause instanceof TypeError) {
    return { kind: 'network' };
  }
  const message = messageOf(cause);
  if (cause instanceof SyntaxError || isProxyMessage(message)) {
    return { kind: 'unavailable' };
  }
  return { kind: 'reported', message };
};

export const unavailableMessage =
  'Wordhold ist gerade kurz nicht erreichbar. Versuche es in ein paar Sekunden noch einmal.';

// What to tell the learner once the retries are over. `offline` is the
// caller's own sentence for a missing connection; the server's message is
// already written for the learner.
export const failureMessage = (cause: unknown, offline: string): string => {
  const failure = classifyServerFailure(cause);
  if (failure.kind === 'network') {
    return offline;
  }
  return failure.kind === 'unavailable' ? unavailableMessage : failure.message;
};

export type RetryTiming = {
  readonly now: () => number;
  readonly wait: (milliseconds: number) => Promise<void>;
};

const browserTiming: RetryTiming = {
  now: () => performance.now(),
  wait: (milliseconds) =>
    new Promise((resolve) => {
      globalThis.setTimeout(resolve, milliseconds);
    }),
};

// The wait doubles from half a second to four seconds: the quick retries
// cover a dropped request, the later ones outlast a restart of the app
// behind the proxy.
const firstDelayMs = 500;
const longestDelayMs = 4000;
const retryWindowMs = 20_000;
const delayBefore = (retry: number): number =>
  Math.min(firstDelayMs * 2 ** retry, longestDelayMs);
// The first two retries pass unmentioned, so a short blip shows nothing.
const quietRetries = 2;

type RetryOptions = {
  readonly isActive: () => boolean;
  // Called once, when the retries have taken long enough to mention.
  readonly onReconnecting: () => void;
  readonly timing?: RetryTiming;
};

// Calls the server function again while it cannot be reached, for about 20
// seconds, and settles like the first successful call or the last failed one.
// An error the server function reported is passed on at once. Only callers
// whose call is safe to repeat may use this.
export const retryUnreachable = <A>(
  call: () => Promise<A>,
  { isActive, onReconnecting, timing = browserTiming }: RetryOptions,
): Promise<A> => {
  const startedAt = timing.now();
  const attempt = async (retries: number): Promise<A> => {
    try {
      return await call();
    } catch (cause) {
      const delay = delayBefore(retries);
      if (
        !isActive() ||
        classifyServerFailure(cause).kind === 'reported' ||
        timing.now() - startedAt + delay > retryWindowMs
      ) {
        throw cause;
      }
      if (retries === quietRetries) {
        onReconnecting();
      }
      await timing.wait(delay);
      // The caller may have left while waiting. Do not start a new request
      // that could save an answer after its card has left the screen.
      if (!isActive()) {
        throw cause;
      }
      return attempt(retries + 1);
    }
  };
  return attempt(0);
};
