import { Effect, Schema } from 'effect';

const refreshMarginMs = 300_000;
const applicationKeys = new Set([
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
]);

// The CLI's credential-process format uses PascalCase; rename on decode so
// the external format stays at this boundary.
const ProcessCredentials = Schema.Struct({
  accessKeyId: Schema.String,
  secretAccessKey: Schema.String,
  sessionToken: Schema.String,
  expiration: Schema.DateFromString,
}).pipe(
  Schema.encodeKeys({
    accessKeyId: 'AccessKeyId',
    secretAccessKey: 'SecretAccessKey',
    sessionToken: 'SessionToken',
    expiration: 'Expiration',
  }),
);

class AwsCliCredentialsError extends Schema.TaggedError<AwsCliCredentialsError>()(
  'AwsCliCredentialsError',
  { message: Schema.String, cause: Schema.Unknown },
) {}

// The benchmark signs Bedrock requests with the developer's `aws login`
// session: the application's IAM user may not invoke every candidate model.
// The CLI resolves environment keys first, so the child runs without them.
const exportCredentials = Effect.tryPromise({
  try: async () => {
    const env = Object.fromEntries(
      Object.entries(globalThis.Bun.env).filter(
        ([key]) => !applicationKeys.has(key),
      ),
    );
    const child = globalThis.Bun.spawn(
      ['aws', 'configure', 'export-credentials', '--format', 'process'],
      { env, stdout: 'pipe', stderr: 'ignore' },
    );
    const [text, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ]);
    if (exitCode !== 0) {
      throw new Error(`aws exited with ${exitCode}`);
    }
    return JSON.parse(text) as unknown;
  },
  catch: (cause) =>
    new AwsCliCredentialsError({
      message: 'AWS CLI credentials unavailable; run `aws login` and retry',
      cause,
    }),
}).pipe(
  Effect.flatMap((raw) =>
    Schema.decodeUnknownEffect(ProcessCredentials)(raw).pipe(
      Effect.mapError(
        (cause) =>
          new AwsCliCredentialsError({
            message: 'AWS CLI returned unexpected credentials',
            cause,
          }),
      ),
    ),
  ),
);

// Exports once up front so the first timed request does not pay for the CLI,
// then re-exports shortly before the session expires.
export const awsCliCredentialProvider = Effect.gen(function* () {
  let current = yield* exportCredentials;
  return async () => {
    if (current.expiration.getTime() - Date.now() < refreshMarginMs) {
      current = await Effect.runPromise(exportCredentials);
    }
    const { expiration: _, ...credentials } = current;
    return credentials;
  };
});
