import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { sentenceJudgeLayer } from '../../../shared/ai/runtime';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import {
  decodeSentenceAnswer,
  decodeSentenceSessionRequest,
} from '../schemas/sentence-models';
import { SentenceGrader } from './sentence-grader';
import { SentenceService } from './sentence-service';
import { SentenceStore } from './sentence-store';

const sentenceRuntime = ManagedRuntime.make(
  SentenceService.Default.pipe(
    Layer.provide(
      Layer.merge(
        SentenceStore.live.pipe(Layer.provide(PgLive)),
        SentenceGrader.live.pipe(Layer.provide(sentenceJudgeLayer)),
      ),
    ),
  ),
);

export const getSentenceSession = createServerFn()
  .validator(decodeSentenceSessionRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return sentenceRuntime.runPromise(
      Effect.flatMap(SentenceService, (service) => service.getSession(data)),
    );
  });

export const checkSentence = createServerFn({ method: 'POST' })
  .validator(decodeSentenceAnswer)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return sentenceRuntime.runPromise(
      Effect.flatMap(SentenceService, (service) => service.check(data)),
    );
  });
