import { Effect } from 'effect';
import {
  CredentialRotationError,
  rotateBedrockApiKey,
} from './rotate-bedrock-api-key';

const secretPath = decodeURIComponent(
  new URL('../../../secrets/dev.yaml', import.meta.url).pathname,
);

const runCommand = (command: {
  readonly args: ReadonlyArray<string>;
  readonly stdin?: string;
}) =>
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

const messages: Array<string> = [];
const result = await Effect.runPromise(
  rotateBedrockApiKey(
    runCommand,
    (message) => messages.push(message),
    secretPath,
  ).pipe(
    Effect.match({
      onFailure: (error) => ({ error }),
      onSuccess: () => ({ error: undefined }),
    }),
  ),
);
if (result.error === undefined) {
  await globalThis.Bun.write(globalThis.Bun.stdout, `${messages.join('\n')}\n`);
} else {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    `${result.error.message} No credential value was printed.\n`,
  );
  // biome-ignore lint/correctness/noProcessGlobal: This CLI boundary must report failure to the shell.
  globalThis.process.exitCode = 1;
}
