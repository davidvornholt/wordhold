import { Extraction } from '@wordhold/ai/extraction';
import { Judge } from '@wordhold/ai/judge';
import { VertexProvider } from '@wordhold/ai/providers/vertex';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Data, Effect, Exit, Layer } from 'effect';

class VerificationError extends Data.TaggedError('VerificationError')<{
  readonly message: string;
}> {}

const services = Layer.mergeAll(
  Extraction.Default,
  Judge.Default,
  SentenceGen.Default,
).pipe(Layer.provide(VertexProvider.live));

const report = (message: string) =>
  Effect.promise(() =>
    globalThis.Bun.write(globalThis.Bun.stdout, `${message}\n`),
  );

const verification = Effect.gen(function* () {
  const judge = yield* Judge;
  const sentences = yield* SentenceGen;
  const extraction = yield* Extraction;
  const verdict = yield* judge.judge({
    direction: 'to_target',
    targetLanguage: 'English',
    prompt: 'das Buch',
    expectedAnswers: ['the book'],
    givenAnswer: 'the book',
  });
  if (!verdict.correct) {
    return yield* new VerificationError({
      message: 'Judge rejected an exact answer.',
    });
  }
  yield* report('Judge verified.');
  const batch = yield* sentences.generate({
    targetText: 'the book',
    nativeText: 'das Buch',
    targetLanguage: 'English',
    count: 1,
  });
  if (batch.sentences.length !== 1) {
    return yield* new VerificationError({
      message: 'Sentence generation returned the wrong count.',
    });
  }
  yield* sentences.translate({
    targetText: 'I read a book.',
    targetLanguage: 'English',
  });
  yield* sentences.translateWord({
    text: 'das Buch',
    given: 'native',
    targetLanguage: 'English',
  });
  yield* report('Sentence generation and translations verified.');
  const image = yield* Effect.tryPromise({
    try: () =>
      globalThis.Bun.file(
        new URL('./fixtures/provider-page.png', import.meta.url),
      ).arrayBuffer(),
    catch: () =>
      new VerificationError({
        message: 'Could not read the synthetic page fixture.',
      }),
  });
  const extracted = yield* extraction.extract({
    imageBase64: Buffer.from(image).toString('base64'),
    mediaType: 'image/png',
    targetLanguage: 'English',
  });
  const fixturePageNumber = 12;
  if (
    extracted.page.pageNumber !== fixturePageNumber ||
    !extracted.page.entries.some(
      (entry) =>
        entry.targetText === 'the book' && entry.nativeText === 'das Buch',
    ) ||
    !extracted.page.entries.some(
      (entry) => entry.targetText === 'to read' && entry.nativeText === 'lesen',
    )
  ) {
    return yield* new VerificationError({
      message: 'Extraction did not reproduce the synthetic page.',
    });
  }
  yield* report(`Page extraction verified (${extracted.modelId}).`);
}).pipe(Effect.provide(services));

const result = await Effect.runPromiseExit(verification);
if (Exit.isFailure(result)) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Vertex provider verification failed; the last reported workload identifies progress.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: This CLI boundary must report failure to the shell.
  globalThis.process.exitCode = 1;
} else {
  await globalThis.Bun.write(
    globalThis.Bun.stdout,
    'Vertex extraction, judge, sentence generation and translations verified.\n',
  );
}
