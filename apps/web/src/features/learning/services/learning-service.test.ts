import { describe, expect, it } from 'bun:test';
import { Effect, Layer, TestContext } from 'effect';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const entryId = '00000000-0000-0000-0000-000000000001';

const storeWith = (store: Partial<LearningStore['Type']>) =>
  LearningService.Default.pipe(
    Layer.provide(
      Layer.succeed(LearningStore, {
        loadPass: () => Effect.succeed(undefined),
        introduce: () => Effect.void,
        ...store,
      }),
    ),
  );

describe('LearningService', () => {
  it('reports an unknown unit instead of an empty pass', async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getPass('00000000-0000-0000-0000-000000000002'),
      ).pipe(Effect.provide(storeWith({})), Effect.either),
    );

    expect(result._tag).toBe('Left');
    const failure = result._tag === 'Left' ? result.left : undefined;
    expect(failure?._tag).toBe('LearningUnitNotFoundError');
  });

  // The timestamp answers "has this person ever met this word", so it comes
  // from the clock at the moment the word is learned rather than from the
  // browser that reported it.
  it('stamps the introduction with the current time', async () => {
    const introduced: Array<{ entryId: string; at: Date }> = [];
    await Effect.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.introduce(entryId),
      ).pipe(
        Effect.provide(
          storeWith({
            introduce: (id, at) =>
              Effect.sync(() => {
                introduced.push({ entryId: id, at });
              }),
          }),
        ),
        Effect.provide(TestContext.TestContext),
      ),
    );

    expect(introduced).toHaveLength(1);
    expect(introduced[0]?.entryId).toBe(entryId);
    expect(introduced[0]?.at.getTime()).toBe(0);
  });
});
