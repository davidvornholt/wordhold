import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { definitionLayer, judgeLayer } from '../../../shared/ai/runtime';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { requestMember } from '../../../shared/auth/member-request';
import {
  decodeSessionRequest,
  decodeStudyRequest,
} from '../schemas/session-request';
import { decodeSubmitPayload } from '../schemas/submission-schema';
import { DefinitionGrader } from './definition-grader';
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

const practiceLive = PracticeService.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      storesLive,
      PracticeJudge.live.pipe(Layer.provide(judgeLayer)),
      DefinitionGrader.live.pipe(Layer.provide(definitionLayer)),
    ),
  ),
);

const practiceRuntime = ManagedRuntime.make(
  practiceLive.pipe(Layer.provideMerge(UsageLedger.live(PgLive))),
);

export const getPracticeSession = createServerFn()
  .validator(decodeSessionRequest)
  .handler(async ({ data }) => {
    // The session queries are limited to this course.
    await requestMember({ courses: [data.courseId] });
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) => service.getSession(data)),
    );
  });

export const getStudySession = createServerFn()
  .validator(decodeStudyRequest)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) =>
        service.getStudySession(data),
      ),
    );
  });

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeSubmitPayload(input))
  .handler(async ({ data }) => {
    const member = await requestMember({ cards: [data.cardId] });
    return practiceRuntime.runPromise(
      Effect.flatMap(PracticeService, (service) => service.submit(data)).pipe(
        billedTo(member.userId),
      ),
    );
  });
