import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import { StorageLive } from '../../../shared/storage/server';
import { decodeSetCourseDirections } from '../schemas/course-directions';
import {
  decodeCreateCourseUnit,
  decodeReorderCourseUnits,
} from '../schemas/course-unit-management';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';
import { VocabularyExampleService } from './vocabulary-example-service';
import { VocabularyExampleStore } from './vocabulary-example-store';

const courseLive = CourseService.Default.pipe(
  Layer.provide(CourseStore.live.pipe(Layer.provide(PgLive))),
);

const courseRuntime = ManagedRuntime.make(courseLive);

const vocabularyExampleDependencies = Layer.merge(
  VocabularyExampleStore.live.pipe(Layer.provide(PgLive)),
  Layer.mergeAll(
    SentenceGen.Default.pipe(Layer.provide(BedrockProvider.live)),
    StorageLive,
    Tts.Default,
  ),
);
const vocabularyExampleRuntime = ManagedRuntime.make(
  VocabularyExampleService.Default.pipe(
    Layer.provide(vocabularyExampleDependencies),
  ),
);

const decodeId = Schema.decodeUnknownSync(Schema.UUID);
const decodeIds = Schema.decodeUnknownSync(Schema.Array(Schema.UUID));

export const getCourseDirections = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.getDirections(courseId),
      ),
    );
  });

export const setCourseDirections = createServerFn({ method: 'POST' })
  .validator(decodeSetCourseDirections)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.setDirections(data)),
    );
  });

export const listCourseUnits = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.listUnits(courseId)),
    );
  });

export const createCourseUnit = createServerFn({ method: 'POST' })
  .validator(decodeCreateCourseUnit)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.createUnit(data)),
    );
  });

export const reorderCourseUnits = createServerFn({ method: 'POST' })
  .validator(decodeReorderCourseUnits)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.reorderUnits(data)),
    );
  });

export const listCourseVocabulary = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.listVocabulary(courseId),
      ),
    );
  });

export const generateVocabularyExample = createServerFn({ method: 'POST' })
  .validator(decodeId)
  .handler(async ({ data: entryId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyExampleRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.generate(entryId),
      ),
    );
  });

export const prepareVocabularyExamples = createServerFn({ method: 'POST' })
  .validator(decodeIds)
  .handler(async ({ data: entryIds }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyExampleRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.prepare(entryIds),
      ),
    );
  });
