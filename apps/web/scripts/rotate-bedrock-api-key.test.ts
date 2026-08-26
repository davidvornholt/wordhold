import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { rotateBedrockApiKey } from './rotate-bedrock-api-key';

describe('rotateBedrockApiKey', () => {
  it('stores the documented Bedrock secret field without putting its value in arguments or logs', async () => {
    const secret = 'ABSK-secret-value';
    const commands: Array<{
      readonly args: ReadonlyArray<string>;
      readonly stdin?: string;
    }> = [];
    const logs: Array<string> = [];
    const responses = [
      '{"ServiceSpecificCredentials":[{"ServiceSpecificCredentialId":"old-id"}]}',
      `{"ServiceSpecificCredential":{"CreateDate":"2026-08-26T09:12:42+00:00","ExpirationDate":"2026-11-24T09:12:42+00:00","ServiceName":"bedrock.amazonaws.com","ServiceCredentialAlias":"WordholdDevelopment-at-765727302936-z1example","ServiceCredentialSecret":${JSON.stringify(secret)},"ServiceSpecificCredentialId":"new-id","UserName":"WordholdDevelopment","Status":"Active"}}`,
      '',
    ];
    const run = (command: (typeof commands)[number]) => {
      commands.push(command);
      return Effect.succeed({
        exitCode: 0,
        stdout: responses[commands.length - 1] ?? '',
      });
    };

    await Effect.runPromise(
      rotateBedrockApiKey(
        run,
        (line) => logs.push(line),
        '/repo/secrets/dev.yaml',
      ),
    );

    expect(commands[1]?.args).toContain('--credential-age-days');
    expect(commands[1]?.args).toContain('90');
    expect(commands[2]?.args).toContain('--value-stdin');
    expect(commands[2]?.args).toContain('/repo/secrets/dev.yaml');
    expect(commands[2]?.stdin).toBe(JSON.stringify(secret));
    expect(JSON.stringify(commands.map(({ args }) => args))).not.toContain(
      secret,
    );
    expect(JSON.stringify(logs)).not.toContain(secret);
    expect(logs).toEqual([
      'Replacement credential: new-id',
      'Predecessor credential: old-id',
    ]);
  });

  it('stops before creation when two credentials already exist', async () => {
    let calls = 0;
    const result = await Effect.runPromise(
      rotateBedrockApiKey(
        () => {
          calls += 1;
          return Effect.succeed({
            exitCode: 0,
            stdout:
              '{"ServiceSpecificCredentials":[{"ServiceSpecificCredentialId":"first"},{"ServiceSpecificCredentialId":"second"}]}',
          });
        },
        () => undefined,
        '/repo/secrets/dev.yaml',
      ).pipe(Effect.either),
    );

    expect(result._tag).toBe('Left');
    expect(calls).toBe(1);
  });
});

describe('rotation failure cleanup', () => {
  it('revokes a replacement when AWS omits the documented secret field', async () => {
    const commands: Array<{ readonly args: ReadonlyArray<string> }> = [];
    const responses = [
      '{"ServiceSpecificCredentials":[{"ServiceSpecificCredentialId":"old-id"}]}',
      '{"ServiceSpecificCredential":{"ServiceSpecificCredentialId":"new-id"}}',
      '',
    ];
    const result = await Effect.runPromise(
      rotateBedrockApiKey(
        (command) => {
          commands.push(command);
          return Effect.succeed({
            exitCode: 0,
            stdout: responses[commands.length - 1] ?? '',
          });
        },
        () => undefined,
        '/repo/secrets/dev.yaml',
      ).pipe(Effect.either),
    );

    expect(result._tag).toBe('Left');
    expect(commands[2]?.args).toContain('delete-service-specific-credential');
    expect(commands[2]?.args).toContain('new-id');
    const message = result._tag === 'Left' ? result.left.message : '';
    expect(message).toContain('automatically revoked');
  });

  it('prints exact revocation guidance when automatic cleanup fails', async () => {
    const secret = 'fixture-secret';
    let calls = 0;
    const result = await Effect.runPromise(
      rotateBedrockApiKey(
        () => {
          calls += 1;
          if (calls === 1) {
            return Effect.succeed({
              exitCode: 0,
              stdout: '{"ServiceSpecificCredentials":[]}',
            });
          }
          if (calls === 2) {
            return Effect.succeed({
              exitCode: 0,
              stdout: `{"ServiceSpecificCredential":{"ServiceSpecificCredentialId":"new-id","ServiceCredentialSecret":${JSON.stringify(secret)}}}`,
            });
          }
          return Effect.succeed({ exitCode: 1, stdout: '' });
        },
        () => undefined,
        '/repo/secrets/dev.yaml',
      ).pipe(Effect.either),
    );

    expect(result._tag).toBe('Left');
    const message = result._tag === 'Left' ? result.left.message : '';
    expect(message).toContain(
      'aws iam delete-service-specific-credential --user-name WordholdDevelopment --service-specific-credential-id new-id',
    );
    expect(message).not.toContain(secret);
  });
});

describe('provider:rotate-bedrock-key', () => {
  it('resolves the SOPS target from the repo when Bun changes into apps/web', async () => {
    const repoRoot = decodeURIComponent(
      new URL('../../../', import.meta.url).pathname,
    );
    const fixtureDir = `/tmp/wordhold-rotation-${crypto.randomUUID()}`;
    const reportPath = `${fixtureDir}/sops-report`;
    const awsPath = `${fixtureDir}/aws`;
    const sopsPath = `${fixtureDir}/sops`;
    await globalThis.Bun.$`mkdir -p ${fixtureDir}`.quiet();
    await globalThis.Bun.write(
      awsPath,
      `#!/bin/sh
case "$2" in
list-service-specific-credentials) printf '%s\n' '{"ServiceSpecificCredentials":[]}' ;;
create-service-specific-credential) printf '%s\n' '{"ServiceSpecificCredential":{"ServiceSpecificCredentialId":"new-id","ServiceCredentialSecret":"fixture-secret"}}' ;;
*) exit 1 ;;
esac
`,
    );
    await globalThis.Bun.write(
      sopsPath,
      `#!/bin/sh
IFS= read -r stdin
printf '%s\n%s\n' "$3" "$stdin" > "$ROTATION_REPORT"
`,
    );
    await globalThis.Bun.$`chmod 700 ${awsPath} ${sopsPath}`.quiet();
    try {
      const child = globalThis.Bun.spawn(
        ['bun', 'run', '--cwd', 'apps/web', 'provider:rotate-bedrock-key'],
        {
          cwd: repoRoot,
          env: {
            ...globalThis.Bun.env,
            // biome-ignore lint/style/useNamingConvention: Child process environment variables use their real uppercase names.
            PATH: `${fixtureDir}:${globalThis.Bun.env.PATH ?? ''}`,
            // biome-ignore lint/style/useNamingConvention: The fake SOPS process consumes this test-only environment variable.
            ROTATION_REPORT: reportPath,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exitCode, stderr).toBe(0);
      expect(stdout).toContain('Replacement credential: new-id');
      const [targetPath, stdin] = (await globalThis.Bun.file(reportPath).text())
        .trimEnd()
        .split('\n');
      expect(targetPath).toBe(`${repoRoot}secrets/dev.yaml`);
      expect(stdin).toBe(JSON.stringify('fixture-secret'));
    } finally {
      await globalThis.Bun.$`rm -rf ${fixtureDir}`.quiet();
    }
  });
});
