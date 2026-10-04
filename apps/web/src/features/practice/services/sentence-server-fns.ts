import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { sentenceJudgeLayer } from '../../../shared/ai/runtime';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { requestMember } from '../../../shared/auth/member-request';
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
    Layer.provideMerge(UsageLedger.live.pipe(Layer.provide(PgLive))),
  ),
);

export const getSentenceSession = createServerFn()
  .validator(decodeSentenceSessionRequest)
  .handler(async ({ data }) => {
    // The session query is limited to this course.
    await requestMember({ courses: [data.courseId] });
    return sentenceRuntime.runPromise(
      Effect.flatMap(SentenceService, (service) => service.getSession(data)),
    );
  });

export const checkSentence = createServerFn({ method: 'POST' })
  .validator(decodeSentenceAnswer)
  .handler(async ({ data }) => {
    const member = await requestMember({ entries: [data.entryId] });
    return sentenceRuntime.runPromise(
      Effect.flatMap(SentenceService, (service) => service.check(data)).pipe(
        billedTo(member.userId),
      ),
    );
  });
