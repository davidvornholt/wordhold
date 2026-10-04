import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import {
  PlaceSelection,
  VocabularySelection,
} from '../../../shared/session/vocabulary-selection';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const learningLive = LearningService.Default.pipe(
  Layer.provide(LearningStore.live.pipe(Layer.provide(PgLive))),
);

const learningRuntime = ManagedRuntime.make(learningLive);

// Without a place the pass covers the whole course.
const decodePassRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    courseId: Schema.UUID,
    place: Schema.optional(PlaceSelection),
  }),
);
const decodeIntroductionRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    courseId: Schema.UUID,
    cardId: Schema.UUID,
  }),
);
const decodeSelectionRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    courseId: Schema.UUID,
    selection: VocabularySelection,
  }),
);

export const getLearnPass = createServerFn()
  .validator(decodePassRequest)
  .handler(async ({ data }) => {
    // Every query below is limited to this course.
    await requestMember({ courses: [data.courseId] });
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getPass(data.courseId, data.place ?? null),
      ),
    );
  });

export const getLearnSelection = createServerFn()
  .validator(decodeSelectionRequest)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getSelection(data.courseId, data.selection),
      ),
    );
  });

export const introduceCard = createServerFn({ method: 'POST' })
  .validator(decodeIntroductionRequest)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.introduce(data.courseId, data.cardId),
      ),
    );
  });
