import { describe, expect, it } from 'bun:test';
import { Effect, Layer, TestContext } from 'effect';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const entryId = '00000000-0000-0000-0000-000000000001';
const courseId = '00000000-0000-0000-0000-000000000002';
const unitId = '00000000-0000-0000-0000-000000000003';

const storeWith = (store: Partial<LearningStore['Type']>) =>
  LearningService.Default.pipe(
    Layer.provide(
      Layer.succeed(LearningStore, {
        loadPass: () => Effect.succeed(undefined),
        introduce: () => Effect.succeed(true),
        ...store,
      }),
    ),
  );

describe('LearningService', () => {
  it('reports an unknown unit instead of an empty pass', async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getPass(courseId, unitId),
      ).pipe(Effect.provide(storeWith({})), Effect.either),
    );

    expect(result._tag).toBe('Left');
    const failure = result._tag === 'Left' ? result.left : undefined;
    expect(failure?._tag).toBe('LearningUnitNotFoundError');
  });

  // The timestamp answers "has this person ever met this entry", so it comes
  // from the clock at the moment the entry is learned rather than from the
  // browser that reported it.
  it('stamps the introduction with the current time', async () => {
    const introduced: Array<{ entryId: string; at: Date }> = [];
    await Effect.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.introduce(courseId, unitId, entryId),
      ).pipe(
        Effect.provide(
          storeWith({
            introduce: (_courseId, _unitId, id, at) =>
              Effect.sync(() => {
                introduced.push({ entryId: id, at });
              }).pipe(Effect.as(true)),
          }),
        ),
        Effect.provide(TestContext.TestContext),
      ),
    );

    expect(introduced).toHaveLength(1);
    expect(introduced[0]?.entryId).toBe(entryId);
    expect(introduced[0]?.at.getTime()).toBe(0);
  });

  it('reports a stale entry instead of accepting a mismatched entry', async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.introduce(courseId, unitId, entryId),
      ).pipe(
        Effect.provide(storeWith({ introduce: () => Effect.succeed(false) })),
        Effect.provide(TestContext.TestContext),
        Effect.either,
      ),
    );

    expect(result._tag).toBe('Left');
    const failure = result._tag === 'Left' ? result.left : undefined;
    expect(failure?._tag).toBe('LearningEntryNotFoundError');
  });
});
