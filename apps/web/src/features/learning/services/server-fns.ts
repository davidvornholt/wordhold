import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const learningLive = LearningService.Default.pipe(
  Layer.provide(LearningStore.live.pipe(Layer.provide(PgLive))),
);

const learningRuntime = ManagedRuntime.make(learningLive);

const decodeId = Schema.decodeUnknownSync(Schema.UUID);

export const listLearnableUnits = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) => service.listUnits(courseId)),
    );
  });

export const getLearnPass = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: unitId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) => service.getPass(unitId)),
    );
  });

export const introduceWord = createServerFn({ method: 'POST' })
  .validator(decodeId)
  .handler(async ({ data: entryId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) => service.introduce(entryId)),
    );
  });
