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
import {
  decodeCreateVocabularyEntry,
  decodeVocabularyExampleRequest,
  decodeVocabularyTranslationRequest,
  decodeVocabularyTranslationSuggestion,
} from '../schemas/vocabulary-entry-creation';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';
import { VocabularyEntryService } from './vocabulary-entry-service';
import { VocabularyEntryStore } from './vocabulary-entry-store';
import { VocabularyExampleService } from './vocabulary-example-service';
import { VocabularyExampleStore } from './vocabulary-example-store';

const courseLive = CourseService.Default.pipe(
  Layer.provide(CourseStore.live.pipe(Layer.provide(PgLive))),
);

const courseRuntime = ManagedRuntime.make(courseLive);

// Examples and typed entries share one runtime: both talk to the sentence
// generator, text-to-speech and file storage.
const vocabularyDependencies = Layer.mergeAll(
  VocabularyExampleStore.live.pipe(Layer.provide(PgLive)),
  VocabularyEntryStore.live.pipe(Layer.provide(PgLive)),
  SentenceGen.Default.pipe(Layer.provide(BedrockProvider.live)),
  StorageLive,
  Tts.Default,
);
const vocabularyRuntime = ManagedRuntime.make(
  Layer.merge(
    VocabularyExampleService.Default,
    VocabularyEntryService.Default,
  ).pipe(Layer.provide(vocabularyDependencies)),
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
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.generate(entryId),
      ),
    );
  });

export const prepareVocabularyExamples = createServerFn({ method: 'POST' })
  .validator(decodeIds)
  .handler(async ({ data: entryIds }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.prepare(entryIds),
      ),
    );
  });

export const createVocabularyEntry = createServerFn({ method: 'POST' })
  .validator(decodeCreateVocabularyEntry)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) => service.create(data)),
    );
  });

export const generateVocabularyDraftExample = createServerFn({
  method: 'POST',
})
  .validator(decodeVocabularyExampleRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.generateExample(data),
      ),
    );
  });

export const translateVocabularyDraftExample = createServerFn({
  method: 'POST',
})
  .validator(decodeVocabularyTranslationRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.translateExample(data),
      ),
    );
  });

export const suggestVocabularyTranslation = createServerFn({ method: 'POST' })
  .validator(decodeVocabularyTranslationSuggestion)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.suggestTranslation(data),
      ),
    );
  });
