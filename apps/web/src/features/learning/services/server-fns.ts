import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
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

const decodePassRequest = Schema.decodeUnknownSync(
  Schema.Struct({ courseId: Schema.UUID, place: PlaceSelection }),
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
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getPass(data.courseId, data.place),
      ),
    );
  });

export const getLearnSelection = createServerFn()
  .validator(decodeSelectionRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.getSelection(data.courseId, data.selection),
      ),
    );
  });

export const introduceCard = createServerFn({ method: 'POST' })
  .validator(decodeIntroductionRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return learningRuntime.runPromise(
      Effect.flatMap(LearningService, (service) =>
        service.introduce(data.courseId, data.cardId),
      ),
    );
  });
