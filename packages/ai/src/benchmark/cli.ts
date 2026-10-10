import { Cause, Duration, Effect, Exit, Semaphore } from 'effect';
import { aiOperations } from '../usage';
import { densePage, simplePage } from './extraction-workloads';
import { type Sample, summarize } from './metrics';
import { benchmarkModels, candidateNames } from './models';
import {
  type BenchmarkModel,
  capacityBackoffSeconds,
  runSample,
  timeoutMs,
} from './runner';
import type { Workload } from './workload';
import { workloads } from './workloads';

// Reserved for each request until its usage is known. Prompts stay well
// below the allowance; output is bounded by the request or by this cap.
const inputTokenAllowance = 20_000;
const assumedMaxOutputTokens = 32_000;
const tokensPerMillion = 1_000_000;
const defaultRepetitions = 3;
const reportEvery = 10;
const usdDecimals = 4;
const reservationPollMs = 250;

const usage = [
  'Usage: bun run benchmark:models /absolute/path/results.json --budget-usd=N',
  '  [--models=a,b] [--workloads=a,b] [--repetitions=N] [--concurrency=N] [--describe]',
  `Models: ${candidateNames.join(', ')}`,
].join('\n');

const writeJson = (path: string, value: unknown) =>
  Effect.promise(() =>
    globalThis.Bun.write(path, `${JSON.stringify(value, null, 2)}\n`),
  );
const print = (message: string) =>
  Effect.promise(() =>
    globalThis.Bun.write(globalThis.Bun.stderr, `${message}\n`),
  );
const sha256 = (data: string | Uint8Array) =>
  new globalThis.Bun.CryptoHasher('sha256').update(data).digest('hex');
const usd = (value: number | null) =>
  value === null ? 'unknown' : `$${value.toFixed(usdDecimals)}`;

const flag = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return globalThis.Bun.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};
const listFlag = (name: string): ReadonlyArray<string> | undefined =>
  flag(name)?.split(',');
const positiveFlag = (name: string, fallback: number | undefined) => {
  const value = flag(name);
  const parsed = value === undefined ? fallback : Number(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
};

const worstCaseUsd = (model: BenchmarkModel): number =>
  model.usdPerMillionTokens === null
    ? Number.POSITIVE_INFINITY
    : (inputTokenAllowance * model.usdPerMillionTokens.input +
        (model.maxOutputTokens ?? assumedMaxOutputTokens) *
          model.usdPerMillionTokens.output) /
      tokensPerMillion;

// Estimated spend. Each request reserves its worst case before it starts, so
// concurrent requests cannot together exceed the limit, and settles to its
// reported cost when it ends.
const makeBudget = (limitUsd: number) => {
  let spentUsd = 0;
  let reservedUsd = 0;
  // Waits while running requests hold the room this one needs. Succeeds with
  // false when it does not fit even once they have settled.
  const reserve = (amountUsd: number): Effect.Effect<boolean> =>
    Effect.suspend(() => {
      if (spentUsd + reservedUsd + amountUsd <= limitUsd) {
        reservedUsd += amountUsd;
        return Effect.succeed(true);
      }
      return reservedUsd > 0
        ? Effect.andThen(
            Effect.sleep(Duration.millis(reservationPollMs)),
            reserve(amountUsd),
          )
        : Effect.succeed(false);
    });
  const settle = (reservedUsdForRequest: number, actualUsd: number | null) => {
    reservedUsd -= reservedUsdForRequest;
    spentUsd += actualUsd ?? reservedUsdForRequest;
  };
  return { reserve, settle, spent: () => spentUsd };
};

type Options = {
  readonly outputPath: string;
  // Undefined only with `--describe`, which sends no requests.
  readonly budgetUsd: number | undefined;
  readonly repetitions: number;
  readonly concurrency: number;
  readonly models: ReadonlyArray<string>;
  readonly cases: ReadonlyArray<Workload>;
};

// Prints usage and returns undefined when the arguments are invalid.
const parseOptions = Effect.gen(function* () {
  const [, , outputPath] = globalThis.Bun.argv;
  const budgetUsd = positiveFlag('budget-usd', undefined);
  const repetitions = positiveFlag('repetitions', defaultRepetitions);
  const concurrency = positiveFlag('concurrency', 1);
  const describe = globalThis.Bun.argv.includes('--describe');
  const models = listFlag('models') ?? candidateNames;
  const allCases = yield* Effect.promise(workloads);
  const selectedCases = listFlag('workloads');
  const unknownNames = [
    ...models.filter((name) => !candidateNames.includes(name)),
    ...(selectedCases ?? []).filter(
      (name) => !allCases.some((item) => item.name === name),
    ),
  ];
  if (
    outputPath === undefined ||
    !outputPath.startsWith('/') ||
    repetitions === undefined ||
    concurrency === undefined ||
    (budgetUsd === undefined && !describe) ||
    unknownNames.length > 0
  ) {
    yield* print(
      unknownNames.length > 0 ? `Unknown: ${unknownNames.join(', ')}` : usage,
    );
    return;
  }
  return {
    outputPath,
    budgetUsd: describe ? undefined : budgetUsd,
    repetitions,
    concurrency,
    models,
    cases: allCases.filter(
      ({ name }) => selectedCases === undefined || selectedCases.includes(name),
    ),
  } satisfies Options;
});

const describeRun = (options: Options) =>
  Effect.gen(function* () {
    const fixtures = yield* Effect.forEach(
      [simplePage.file, densePage.file],
      (file) =>
        Effect.promise(() =>
          globalThis.Bun.file(new URL(`./fixtures/${file}`, import.meta.url))
            .bytes()
            .then((bytes) => ({ file, sha256: sha256(bytes) })),
        ),
    );
    return {
      startedAt: new Date().toISOString(),
      repetitions: options.repetitions,
      concurrency: options.concurrency,
      timeoutMs,
      maxRetries: 0,
      capacityBackoffSeconds,
      latency:
        'End-to-end wall time of the request that was served, excluding capacity retries and their waits. Requests run concurrently, round-robin across models.',
      tokens:
        'SDK usage: output includes reasoning; visible output excludes reasoning. Unknown counts stay null. Provider tokenizers and image accounting differ.',
      cost: 'Estimated from reported tokens and list prices, excluding tax and discounts.',
      quality:
        'Deterministic regression checks only, not a full language-quality evaluation. All output retained for human review.',
      workloads: options.cases.map((item) => ({
        name: item.name,
        operation: item.operation,
        promptCharacters: item.prompt.length,
        promptSha256: sha256(item.prompt),
      })),
      fixtures,
    };
  });

// Rotate the first model on each pass so every model gets each position.
const planTasks = (
  models: ReadonlyArray<BenchmarkModel>,
  cases: ReadonlyArray<Workload>,
  repetitions: number,
) =>
  Array.from({ length: repetitions }, (_pass, repetition) =>
    cases.flatMap((workload) =>
      models.map((_model, offset) => ({
        repetition: repetition + 1,
        workload,
        model: models[(repetition + offset) % models.length] ?? models[0],
      })),
    ),
  ).flat();

const summaries = (
  models: ReadonlyArray<BenchmarkModel>,
  cases: ReadonlyArray<Workload>,
  samples: ReadonlyArray<Sample>,
) =>
  models.map((model) => {
    const own = samples.filter((sample) => sample.model === model.name);
    return {
      model: model.name,
      ...summarize(own),
      operations: aiOperations
        .filter((operation) =>
          own.some((sample) => sample.operation === operation),
        )
        .map((operation) => ({
          operation,
          ...summarize(own.filter((sample) => sample.operation === operation)),
        })),
      workloads: cases.map((item) => ({
        workload: item.name,
        ...summarize(own.filter((sample) => sample.workload === item.name)),
      })),
    };
  });

const runBenchmark = (
  options: Options,
  budgetUsd: number,
  metadata: Effect.Success<ReturnType<typeof describeRun>>,
) =>
  Effect.gen(function* () {
    const models = yield* benchmarkModels(options.models);
    const unpriced = models.filter(
      ({ usdPerMillionTokens }) => usdPerMillionTokens === null,
    );
    if (unpriced.length > 0) {
      yield* print(
        `No price recorded for ${unpriced.map(({ name }) => name).join(', ')}; add one before running it under a budget.`,
      );
      return false;
    }
    const tasks = planTasks(models, options.cases, options.repetitions);
    const samples: Array<Sample> = [];
    const budget = makeBudget(budgetUsd);
    let skipped = 0;
    const report = () => ({
      ...metadata,
      updatedAt: new Date().toISOString(),
      budgetUsd,
      estimatedSpendUsd: budget.spent(),
      plannedRequests: tasks.length,
      skippedForBudget: skipped,
      models: models.map(
        ({
          name,
          region,
          reasoning,
          usdPerMillionTokens,
          maxOutputTokens,
        }) => ({
          name,
          region,
          reasoning,
          usdPerMillionTokens,
          maxOutputTokens: maxOutputTokens ?? null,
        }),
      ),
      summaries: summaries(models, options.cases, samples),
      samples,
    });
    const writing = yield* Semaphore.make(1);
    const writeReport = Semaphore.withPermit(
      writing,
      Effect.suspend(() => writeJson(options.outputPath, report())),
    );
    yield* Effect.forEach(
      tasks,
      ({ repetition, workload, model }) =>
        Effect.gen(function* () {
          if (model === undefined) {
            return;
          }
          const reserve = worstCaseUsd(model);
          if (!(yield* budget.reserve(reserve))) {
            skipped += 1;
            return;
          }
          const sample = yield* runSample(model, workload, repetition);
          budget.settle(reserve, sample.usd);
          samples.push(sample);
          yield* print(
            `[${samples.length}/${tasks.length}] ${model.name} ${workload.name} #${repetition}: ${Math.round(sample.elapsedMs)} ms; ${sample.error ?? (sample.qualityFailures.join(', ') || 'pass')}; ${usd(sample.usd)}; spent ${usd(budget.spent())}`,
          );
          if (samples.length % reportEvery === 0) {
            yield* writeReport;
          }
        }),
      { concurrency: options.concurrency, discard: true },
    );
    yield* writeReport;
    for (const summary of report().summaries) {
      yield* print(
        `${summary.model}: ${summary.qualityPasses}/${summary.requests} pass, median ${Math.round(summary.medianLatencyMs ?? 0)} ms, ${usd(summary.usd)}`,
      );
    }
    if (skipped > 0) {
      yield* print(`${skipped} requests skipped to stay within the budget.`);
    }
    return skipped === 0;
  });

const program = Effect.gen(function* () {
  const options = yield* parseOptions;
  if (options === undefined) {
    return false;
  }
  const metadata = yield* describeRun(options);
  if (options.budgetUsd === undefined) {
    yield* writeJson(options.outputPath, metadata);
    return true;
  }
  return yield* runBenchmark(options, options.budgetUsd, metadata);
});

const result = await Effect.runPromiseExit(program);
if (Exit.isFailure(result)) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    `${Cause.pretty(result.cause)}\n`,
  );
}
if (Exit.isFailure(result) || !result.value) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Benchmark incomplete; inspect the report.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: A CLI must communicate failed verification to its caller.
  globalThis.process.exitCode = 1;
}
