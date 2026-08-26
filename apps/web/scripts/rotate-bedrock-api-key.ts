import { Data, Effect, Schema } from 'effect';
import {
  CreatedCredential,
  CreatedCredentialIdentity,
  ListedCredentials,
} from './bedrock-credential-response';

const iamUser = 'WordholdDevelopment';
const serviceName = 'bedrock.amazonaws.com';
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

const decodeJson = <A, I>(schema: Schema.Schema<A, I>, value: string) =>
  Schema.decodeUnknown(Schema.parseJson(schema))(value).pipe(
    Effect.mapError(
      () =>
        new CredentialRotationError({
          message: 'AWS returned an unexpected credential response.',
        }),
    ),
  );

const deleteCredential = (id: string): Command => ({
  args: [
    'aws',
    'iam',
    'delete-service-specific-credential',
    '--user-name',
    iamUser,
    '--service-specific-credential-id',
    id,
    '--no-cli-pager',
  ],
});

const revocationCommand = (id: string) =>
  `aws iam delete-service-specific-credential --user-name ${iamUser} --service-specific-credential-id ${id}`;

const failAfterCreate = (execute: RunCommand, id: string, failure: string) =>
  execute(deleteCredential(id)).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.fail(
          new CredentialRotationError({
            message: `${failure} Automatic cleanup failed. Revoke ${id} with: ${revocationCommand(id)}`,
          }),
        ),
      onSuccess: (result) =>
        Effect.fail(
          new CredentialRotationError({
            message:
              result.exitCode === 0
                ? `${failure} The replacement ${id} was automatically revoked.`
                : `${failure} Automatic cleanup failed. Revoke ${id} with: ${revocationCommand(id)}`,
          }),
        ),
    }),
  );

export const rotateBedrockApiKey = (
  execute: RunCommand,
  log: (message: string) => void,
  secretPath: string,
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

    const creationResult = yield* execute({
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
    });
    if (creationResult.exitCode !== 0) {
      return yield* new CredentialRotationError({
        message: 'AWS did not create a replacement Bedrock API key.',
      });
    }

    const identity = yield* decodeJson(
      CreatedCredentialIdentity,
      creationResult.stdout,
    );
    const created = yield* decodeJson(
      CreatedCredential,
      creationResult.stdout,
    ).pipe(
      Effect.catchAll(() =>
        failAfterCreate(
          execute,
          identity.credential.id,
          'AWS created a replacement, but its response did not contain the documented secret field.',
        ),
      ),
    );
    const { credential } = created;
    const stored = yield* execute({
      args: ['sops', 'set', '--value-stdin', secretPath, secretIndex],
      stdin: JSON.stringify(credential.value),
    }).pipe(
      Effect.catchAll(() =>
        failAfterCreate(
          execute,
          credential.id,
          'AWS created a replacement, but SOPS did not store it.',
        ),
      ),
    );
    if (stored.exitCode !== 0) {
      return yield* failAfterCreate(
        execute,
        credential.id,
        'AWS created a replacement, but SOPS did not store it.',
      );
    }

    log(`Replacement credential: ${credential.id}`);
    if (oldIds[0] !== undefined) {
      log(`Predecessor credential: ${oldIds[0]}`);
    }
  });
