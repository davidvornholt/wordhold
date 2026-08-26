import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { judgeLayer } from '../../../shared/ai/runtime';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import {
  decodeDrillRequest,
  decodeSessionRequest,
} from '../schemas/session-request';
import { decodeSubmitPayload } from '../schemas/submission-schema';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeService } from './practice-service';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

const storesLive = Layer.mergeAll(
  PracticeSessionStore.live,
  PracticeReviewStore.live,
  JudgeCacheStore.live,
).pipe(Layer.provide(PgLive));

const practiceLive = PracticeService.Default.pipe(
  Layer.provide(
    Layer.merge(storesLive, PracticeJudge.live.pipe(Layer.provide(judgeLayer))),
  ),
);

const practiceRuntime = ManagedRuntime.make(practiceLive);

export const getPracticeSession = createServerFn()
  .validator(decodeSessionRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) => service.getSession(data)),
    );
  });

export const getUnitDrill = createServerFn()
  .validator(decodeDrillRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) => service.getDrill(data)),
    );
  });

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeSubmitPayload(input))
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) => service.submit(data)),
    );
  });
