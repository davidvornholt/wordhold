import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { rotateBedrockApiKey } from './rotate-bedrock-api-key';

describe('rotateBedrockApiKey', () => {
  it('stores a 90-day replacement without putting its value in arguments or logs', async () => {
    const secret = 'ABSK-secret-value';
    const commands: Array<{
      readonly args: ReadonlyArray<string>;
      readonly stdin?: string;
    }> = [];
    const logs: Array<string> = [];
    const responses = [
      '{"ServiceSpecificCredentials":[{"ServiceSpecificCredentialId":"old-id"}]}',
      `{"ServiceSpecificCredential":{"ServiceSpecificCredentialId":"new-id","ServiceApiKeyValue":${JSON.stringify(secret)}}}`,
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
      rotateBedrockApiKey(run, (line) => logs.push(line)),
    );

    expect(commands[1]?.args).toContain('--credential-age-days');
    expect(commands[1]?.args).toContain('90');
    expect(commands[2]?.args).toContain('--value-stdin');
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
      ).pipe(Effect.either),
    );

    expect(result._tag).toBe('Left');
    expect(calls).toBe(1);
  });
});
