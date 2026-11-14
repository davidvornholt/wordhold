import { afterEach, expect, it } from 'bun:test';
import { ConfigProvider, Effect, Schema } from 'effect';
import { worstCaseUsd } from './budget';
import { benchmarkModels, candidateNames } from './models';
import { runSample } from './runner';
import type { Workload } from './workload';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const claudeNames = candidateNames.filter((name) => name.startsWith('claude-'));

it('reserves at least the cost of the output limit each Claude request sends', async () => {
  const requestedLimits: Array<unknown> = [];
  // An intercepted fetch: no request leaves the machine.
  globalThis.fetch = Object.assign(
    (_url: unknown, init?: { readonly body?: unknown }) => {
      requestedLimits.push(JSON.parse(String(init?.body)).max_tokens);
      return Promise.resolve(
        Response.json(
          { error: { type: 'api_error', message: 'test' } },
          { status: 500 },
        ),
      );
    },
    { preconnect: realFetch.preconnect },
  );
  const models = await Effect.runPromise(
    benchmarkModels(claudeNames).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown(
            Object.fromEntries([['ANTHROPIC_API_KEY', 'test-key']]),
          ),
        ),
      ),
    ),
  );
  expect(models).toHaveLength(claudeNames.length);
  const probe: Workload = {
    name: 'probe',
    operation: 'answer-grading',
    prompt: 'Answer.',
    messages: [{ role: 'user', content: 'Answer.' }],
    schema: Schema.Struct({ answer: Schema.Boolean }),
    qualityFailures: () => [],
  };
  // Sequential, so each request is matched to its model by position.
  await Effect.runPromise(
    Effect.forEach(models, (model) => runSample(model, probe, 1)),
  );
  expect(requestedLimits).toEqual(models.map((model) => model.maxOutputTokens));
  for (const model of models) {
    const outputUsd =
      (model.maxOutputTokens * model.usdPerMillionTokens.output) / 1_000_000;
    expect(worstCaseUsd(model)).toBeGreaterThanOrEqual(outputUsd);
  }
});
