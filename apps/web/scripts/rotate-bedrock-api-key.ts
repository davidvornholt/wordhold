import { Data, Effect, Exit, Schema } from 'effect';

const iamUser = 'WordholdDevelopment';
const serviceName = 'bedrock.amazonaws.com';
const secretPath = 'secrets/dev.yaml';
const secretIndex = ['apps', 'web', 'AWS_BEDROCK_API_KEY']
  .map((key) => `[${JSON.stringify(key)}]`)
  .join('');

type Command = {
  readonly args: ReadonlyArray<string>;
  readonly stdin?: string;
};

type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
};

export class CredentialRotationError extends Data.TaggedError(
  'CredentialRotationError',
)<{
  readonly message: string;
}> {}

type RunCommand = (
  command: Command,
) => Effect.Effect<CommandResult, CredentialRotationError>;

const ListedCredentials = Schema.Struct({
  credentials: Schema.propertySignature(
    Schema.Array(
      Schema.Struct({
        id: Schema.propertySignature(Schema.String).pipe(
          Schema.fromKey('ServiceSpecificCredentialId'),
        ),
      }),
    ),
  ).pipe(Schema.fromKey('ServiceSpecificCredentials')),
});

const CreatedCredential = Schema.Struct({
  credential: Schema.propertySignature(
    Schema.Struct({
      id: Schema.propertySignature(Schema.String).pipe(
        Schema.fromKey('ServiceSpecificCredentialId'),
      ),
      value: Schema.propertySignature(Schema.String).pipe(
        // biome-ignore lint/security/noSecrets: This is an AWS response field name, not a credential value.
        Schema.fromKey('ServiceApiKeyValue'),
      ),
    }),
  ).pipe(Schema.fromKey('ServiceSpecificCredential')),
});

const decodeJson = <A, I>(schema: Schema.Schema<A, I>, value: string) =>
  Schema.decodeUnknown(Schema.parseJson(schema))(value).pipe(
    Effect.mapError(
      () =>
        new CredentialRotationError({
          message: 'AWS returned an unexpected credential response.',
        }),
    ),
  );

export const rotateBedrockApiKey = (
  execute: RunCommand,
  log: (message: string) => void,
) =>
  Effect.gen(function* () {
    const listed = yield* execute({
      args: [
        'aws',
        'iam',
        'list-service-specific-credentials',
        '--user-name',
        iamUser,
        '--service-name',
        serviceName,
        '--output',
        'json',
        '--no-cli-pager',
      ],
    }).pipe(
      Effect.flatMap((result) =>
        result.exitCode === 0
          ? decodeJson(ListedCredentials, result.stdout)
          : Effect.fail(
              new CredentialRotationError({
                message: 'Could not list the current Bedrock API keys.',
              }),
            ),
      ),
    );
    const oldIds = listed.credentials.map(({ id }) => id);
    if (oldIds.length > 1) {
      return yield* new CredentialRotationError({
        message:
          'Two Bedrock API keys already exist. Reconcile them before creating another.',
      });
    }

    const created = yield* execute({
      args: [
        'aws',
        'iam',
        'create-service-specific-credential',
        '--user-name',
        iamUser,
        '--service-name',
        serviceName,
        '--credential-age-days',
        '90',
        '--output',
        'json',
        '--no-cli-pager',
      ],
    }).pipe(
      Effect.flatMap((result) =>
        result.exitCode === 0
          ? decodeJson(CreatedCredential, result.stdout)
          : Effect.fail(
              new CredentialRotationError({
                message: 'AWS did not create a replacement Bedrock API key.',
              }),
            ),
      ),
    );
    const { credential } = created;
    const stored = yield* execute({
      args: ['sops', 'set', '--value-stdin', secretPath, secretIndex],
      stdin: JSON.stringify(credential.value),
    });
    if (stored.exitCode !== 0) {
      return yield* new CredentialRotationError({
        message: `AWS created ${credential.id}, but SOPS did not store it. Revoke that credential before retrying.`,
      });
    }

    log(`Replacement credential: ${credential.id}`);
    if (oldIds[0] !== undefined) {
      log(`Predecessor credential: ${oldIds[0]}`);
    }
  });

const runCommand: RunCommand = (command) =>
  Effect.tryPromise({
    try: async () => {
      const child = globalThis.Bun.spawn(command.args, {
        stdin: command.stdin === undefined ? 'ignore' : 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });
      if (command.stdin !== undefined) {
        child.stdin.write(command.stdin);
        child.stdin.end();
      }
      const [exitCode, stdout] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { exitCode, stdout };
    },
    catch: () =>
      new CredentialRotationError({
        message: 'Could not start AWS CLI or SOPS.',
      }),
  });

if (import.meta.main) {
  const messages: Array<string> = [];
  const result = await Effect.runPromiseExit(
    rotateBedrockApiKey(runCommand, (message) => messages.push(message)),
  );
  if (Exit.isFailure(result)) {
    await globalThis.Bun.write(
      globalThis.Bun.stderr,
      'Bedrock API key rotation failed. No credential value was printed.\n',
    );
    // biome-ignore lint/correctness/noProcessGlobal: This CLI boundary must report failure to the shell.
    globalThis.process.exitCode = 1;
  } else {
    await globalThis.Bun.write(
      globalThis.Bun.stdout,
      `${messages.join('\n')}\n`,
    );
  }
}
