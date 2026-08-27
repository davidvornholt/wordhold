import { Judge } from '@wordhold/ai/judge';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Effect, Exit, Layer } from 'effect';

const services = Layer.merge(Judge.Default, SentenceGen.Default).pipe(
  Layer.provide(BedrockProvider.live),
);

const verification = Effect.gen(function* () {
  const judge = yield* Judge;
  const sentences = yield* SentenceGen;
  yield* judge.judge({
    direction: 'to_target',
    targetLanguage: 'English',
    prompt: 'Er sagte: „Café \\"München\\" ☕“.',
    expectedAnswers: ['He said, “Café \\"Munich\\" ☕.”'],
    givenAnswer: 'He said: "Café \\"Munich\\" ☕."',
    entryType: 'sentence',
  });
  yield* sentences.generate({
    targetText: '„Café \\"München\\" ☕“',
    nativeText: '"Café \\"Munich\\" ☕"',
    targetLanguage: 'German',
    count: 1,
  });
}).pipe(Effect.provide(services));

const result = await Effect.runPromiseExit(verification);
if (Exit.isFailure(result)) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Bedrock provider verification failed.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: This CLI boundary must report failure to the shell.
  globalThis.process.exitCode = 1;
} else {
  await globalThis.Bun.write(
    globalThis.Bun.stdout,
    'Bedrock judge and sentence generation verified.\n',
  );
}
