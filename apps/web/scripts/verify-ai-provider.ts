import { aiPrice, estimateUsd } from '@wordhold/ai/cost';
import { DefinitionJudge } from '@wordhold/ai/definition/judge';
import { isDefinitionCorrect } from '@wordhold/ai/definition/schema';
import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Extraction } from '@wordhold/ai/extraction';
import { Judge } from '@wordhold/ai/judge';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { SentenceGen } from '@wordhold/ai/sentence';
import { SentenceJudge } from '@wordhold/ai/sentence/judge';
import { isSentenceCorrect } from '@wordhold/ai/sentence/judge-schema';
import { Stt } from '@wordhold/ai/stt';
import { AiUsage } from '@wordhold/ai/usage';
import { Cause, Data, Effect, Exit, Layer, Option } from 'effect';

class VerificationError extends Data.TaggedError('VerificationError')<{
  readonly message: string;
}> {}

// Small requests cost fractions of a cent.
const reportedUsdDecimals = 4;

const report = (message: string) =>
  Effect.promise(() =>
    globalThis.Bun.write(globalThis.Bun.stdout, `${message}\n`),
  );

// The check runs outside the app and bills nobody in it, so each request's
// estimated cost is printed instead of recorded.
const printedUsage = Layer.succeed(
  AiUsage,
  AiUsage.of({
    start: (call) =>
      Effect.succeed({
        settle: ({ usage }) => {
          const price = aiPrice(call);
          const usd =
            usage === undefined || price === undefined
              ? undefined
              : estimateUsd(usage, price);
          return report(
            `${call.operation}: ${usd === undefined ? 'cost unknown' : `about $${usd.toFixed(reportedUsdDecimals)}`}`,
          ).pipe(Effect.asVoid);
        },
      }),
  }),
);

const services = Layer.mergeAll(
  DefinitionJudge.Default,
  DefinitionWriter.Default,
  Extraction.Default,
  Judge.Default,
  SentenceGen.Default,
  SentenceJudge.Default,
).pipe(
  Layer.provide(BedrockProvider.live),
  Layer.merge(Stt.Default),
  Layer.merge(printedUsage),
);

const verifySentences = Effect.gen(function* () {
  const sentences = yield* SentenceGen;
  const sentenceJudge = yield* SentenceJudge;
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
  const sentenceVerdict = yield* sentenceJudge.judge({
    targetLanguage: 'English',
    sentence: 'Ich lese ein Buch.',
    reference: 'I read a book.',
    word: { target: 'the book', german: 'das Buch' },
    givenAnswer: 'I read a book.',
  });
  if (!isSentenceCorrect(sentenceVerdict)) {
    return yield* new VerificationError({
      message: 'Sentence judge rejected an exact translation.',
    });
  }
  yield* report('Sentence generation, translations and grading verified.');
});

// Polly's German voice Vicki saying "Seid fröhlich in Hoffnung." (Romans
// 12:12 in the Luther Bible of 1912), as 16 kHz PCM the way the app records.
const verifyDictation = Effect.gen(function* () {
  const stt = yield* Stt;
  const audio = yield* Effect.tryPromise({
    try: () =>
      globalThis.Bun.file(
        new URL('./fixtures/provider-speech.pcm', import.meta.url),
      ).bytes(),
    catch: () =>
      new VerificationError({
        message: 'Could not read the synthetic speech fixture.',
      }),
  });
  const { transcript } = yield* stt.transcribe({ audio });
  if (!transcript.toLowerCase().includes('hoffnung')) {
    return yield* new VerificationError({
      message: 'Transcription did not recognize the synthetic speech.',
    });
  }
  yield* report('Dictation verified.');
});

const verification = Effect.gen(function* () {
  const judge = yield* Judge;
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
  const definitionJudge = yield* DefinitionJudge;
  const definitions = yield* DefinitionWriter;
  const definitionVerdict = yield* definitionJudge.judge({
    term: 'Elektronendonator',
    definition: 'Ein Elektronendonator gibt Elektronen ab.',
    keyPoints: ['gibt Elektronen ab'],
    givenAnswer: 'Ein Elektronendonator gibt Elektronen ab.',
  });
  if (!isDefinitionCorrect(definitionVerdict)) {
    return yield* new VerificationError({
      message: 'Definition judge rejected an exact definition.',
    });
  }
  yield* definitions.keyPoints({
    term: 'Elektronendonator',
    definition: 'Ein Elektronendonator gibt Elektronen ab.',
  });
  yield* definitions.suggest({ term: 'Elektronendonator', subject: 'Chemie' });
  yield* report('Definition grading and writing verified.');
  yield* verifySentences;
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
  yield* verifyDictation;
}).pipe(Effect.provide(services));

const result = await Effect.runPromiseExit(verification);
if (Exit.isFailure(result)) {
  const failure = Cause.failureOption(result.cause);
  if (Option.isSome(failure)) {
    const error = failure.value;
    const providerCause = 'cause' in error ? error.cause : undefined;
    const status =
      typeof providerCause === 'object' &&
      providerCause !== null &&
      'statusCode' in providerCause &&
      typeof providerCause.statusCode === 'number'
        ? ` (HTTP ${providerCause.statusCode})`
        : '';
    await globalThis.Bun.write(
      globalThis.Bun.stderr,
      `${error._tag}${status}\n`,
    );
  }
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Sonnet medium provider verification failed; the last reported workload identifies progress.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: This CLI boundary must report failure to the shell.
  globalThis.process.exitCode = 1;
} else {
  await globalThis.Bun.write(
    globalThis.Bun.stdout,
    'Sonnet medium extraction, vocabulary, definition and sentence grading, writing, sentence generation and translations verified, and Transcribe dictation verified.\n',
  );
}
