import { Effect, Exit } from 'effect';
import { type Sample, summarize } from './metrics';
import { benchmarkModels } from './models';
import { maxOutputTokens, runSample, timeoutMs } from './runner';

import { workloads } from './workloads';

const repetitions = 3;

const writeJson = (path: string, value: unknown) =>
  Effect.promise(() =>
    globalThis.Bun.write(path, `${JSON.stringify(value, null, 2)}\n`),
  );
const print = (message: string) =>
  Effect.promise(() =>
    globalThis.Bun.write(globalThis.Bun.stderr, `${message}\n`),
  );

const program = Effect.gen(function* () {
  const [, , outputPath] = globalThis.Bun.argv;
  if (!outputPath || outputPath.startsWith('--')) {
    yield* print(
      'Usage: bun run benchmark:models /absolute/path/results.json [--describe]',
    );
    return false;
  }
  const cases = yield* Effect.promise(workloads);
  const metadata = {
    startedAt: new Date().toISOString(),
    repetitions,
    maxOutputTokens,
    timeoutMs,
    maxRetries: 0,
    reasoning: 'high',
    concurrency: 1,
    denominator:
      'Sum of end-to-end request wall times for each group, including failures; excludes time between requests; includes cold authentication on the first request. Not provider rate limits or streaming decode speed.',
    tokens:
      'SDK usage: output includes reasoning; visible output excludes reasoning. Unknown counts stay null. Provider tokenizers and image accounting differ.',
    quality:
      'Deterministic regression checks only, not a full language-quality evaluation. All output retained for human review.',
    workloads: cases.map((item) => ({
      name: item.name,
      promptCharacters: item.prompt.length,
      promptSha256: new globalThis.Bun.CryptoHasher('sha256')
        .update(item.prompt)
        .digest('hex'),
    })),
    fixtureSha256: new globalThis.Bun.CryptoHasher('sha256')
      .update(
        yield* Effect.promise(() =>
          globalThis.Bun.file(
            new URL('./fixtures/page.png', import.meta.url),
          ).arrayBuffer(),
        ),
      )
      .digest('hex'),
  };
  if (globalThis.Bun.argv.includes('--describe')) {
    yield* writeJson(outputPath, metadata);
    return true;
  }
  const models = yield* benchmarkModels;
  const samples: Array<Sample> = [];
  const report = () => ({
    ...metadata,
    updatedAt: new Date().toISOString(),
    models: models.map(({ name, region }) => ({ name, region })),
    summaries: models.map((model) => ({
      model: model.name,
      ...summarize(samples.filter((sample) => sample.model === model.name)),
      workloads: cases.map((item) => ({
        workload: item.name,
        ...summarize(
          samples.filter(
            (sample) =>
              sample.model === model.name && sample.workload === item.name,
          ),
        ),
      })),
    })),
    samples,
  });
  // Rotate the first provider on each pass so every provider gets each order position.
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const workload of cases) {
      for (let offset = 0; offset < models.length; offset += 1) {
        const model = models[(repetition + offset) % models.length];
        if (!model) {
          return false;
        }
        yield* print(`${repetition + 1}/3 ${workload.name} ${model.name}`);
        const sample = yield* runSample(model, workload, repetition + 1);
        samples.push(sample);
        yield* writeJson(outputPath, report());
        yield* print(
          `${Math.round(sample.elapsedMs)} ms; ${sample.error ?? `${sample.qualityFailures.length} quality failures`}`,
        );
      }
    }
  }
  return samples.every(
    (sample) => sample.error === null && sample.qualityFailures.length === 0,
  );
});

const result = await Effect.runPromiseExit(program);
if (Exit.isFailure(result) || !result.value) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Benchmark incomplete or quality checks failed; inspect the report.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: A CLI must communicate failed verification to its caller.
  globalThis.process.exitCode = 1;
}
