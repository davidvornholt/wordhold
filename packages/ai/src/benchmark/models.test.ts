import { expect, it } from 'bun:test';
import { ConfigProvider, Effect } from 'effect';
import { benchmarkModels } from './models';

it('builds no provider for a name that is not a candidate', async () => {
  // Without credentials, building any provider fails on its missing key.
  const models = await Effect.runPromise(
    benchmarkModels(['openai.gpt-6-luna']).pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
    ),
  );
  expect(models).toEqual([]);
});
