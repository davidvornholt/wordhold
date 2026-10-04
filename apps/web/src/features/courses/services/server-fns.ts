import { createServerFn } from '@tanstack/react-start';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import {
  requestMember,
  requestOwnedEntries,
} from '../../../shared/auth/member-request';
import { StorageLive } from '../../../shared/storage/server';
import { decodeSetCourseDirections } from '../schemas/course-directions';
import {
  decodeCreateCourseBook,
  decodeCreateCourseUnit,
  decodeRenameCourseBook,
  decodeReorderCourseUnits,
} from '../schemas/course-unit-management';
import {
  decodeDeleteEntry,
  decodeUpdateVocabularyEntry,
} from '../schemas/entry-changes';
import {
  decodeCreateSubject,
  decodeRenameSubject,
} from '../schemas/subject-management';
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
  UsageLedger.live.pipe(Layer.provide(PgLive)),
);
const vocabularyRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    VocabularyExampleService.Default,
    VocabularyEntryService.Default,
  ).pipe(Layer.provideMerge(vocabularyDependencies)),
);

const decodeId = Schema.decodeUnknownSync(Schema.UUID);
const decodeIds = Schema.decodeUnknownSync(Schema.Array(Schema.UUID));

export const getCourseDirections = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await requestMember({ courses: [courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.getDirections(courseId),
      ),
    );
  });

export const setCourseDirections = createServerFn({ method: 'POST' })
  .validator(decodeSetCourseDirections)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.setDirections(data)),
    );
  });

export const createSubject = createServerFn({ method: 'POST' })
  .validator(decodeCreateSubject)
  .handler(async ({ data }) => {
    const member = await requestMember();
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.createSubject(member.userId, data),
      ),
    );
  });

export const renameSubject = createServerFn({ method: 'POST' })
  .validator(decodeRenameSubject)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.renameSubject(data)),
    );
  });

export const getCourseOutline = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await requestMember({ courses: [courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.getOutline(courseId)),
    );
  });

export const createCourseBook = createServerFn({ method: 'POST' })
  .validator(decodeCreateCourseBook)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.createBook(data)),
    );
  });

export const renameCourseBook = createServerFn({ method: 'POST' })
  .validator(decodeRenameCourseBook)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      books: [data.bookId],
    });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.renameBook(data)),
    );
  });

export const createCourseUnit = createServerFn({ method: 'POST' })
  .validator(decodeCreateCourseUnit)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      books: [data.bookId],
    });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.createUnit(data)),
    );
  });

export const reorderCourseUnits = createServerFn({ method: 'POST' })
  .validator(decodeReorderCourseUnits)
  .handler(async ({ data }) => {
    // Only units of this book are reordered, so the unit ids need no check.
    await requestMember({ courses: [data.courseId], books: [data.bookId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.reorderUnits(data)),
    );
  });

export const listCourseVocabulary = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await requestMember({ courses: [courseId] });
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.listVocabulary(courseId),
      ),
    );
  });

export const generateVocabularyExample = createServerFn({ method: 'POST' })
  .validator(decodeId)
  .handler(async ({ data: entryId }) => {
    const member = await requestMember({ entries: [entryId] });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.generate(entryId),
      ).pipe(billedTo(member.userId)),
    );
  });

export const prepareVocabularyExamples = createServerFn({ method: 'POST' })
  .validator(decodeIds)
  .handler(async ({ data: entryIds }) => {
    const { member, owned } = await requestOwnedEntries(entryIds);
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyExampleService, (service) =>
        service.prepare(owned),
      ).pipe(billedTo(member.userId)),
    );
  });

export const createVocabularyEntry = createServerFn({ method: 'POST' })
  .validator(decodeCreateVocabularyEntry)
  .handler(async ({ data }) => {
    const member = await requestMember({
      courses: [data.courseId],
      books: [data.bookId],
      units: data.unitId === null ? [] : [data.unitId],
    });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.create(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const updateVocabularyEntry = createServerFn({ method: 'POST' })
  .validator(decodeUpdateVocabularyEntry)
  .handler(async ({ data }) => {
    const member = await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.update(data),
      ).pipe(billedTo(member.userId)),
    );
  });

// Words and terms alike.
export const deleteCourseEntry = createServerFn({ method: 'POST' })
  .validator(decodeDeleteEntry)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) => service.remove(data)),
    );
  });

export const generateVocabularyDraftExample = createServerFn({
  method: 'POST',
})
  .validator(decodeVocabularyExampleRequest)
  .handler(async ({ data }) => {
    const member = await requestMember({ courses: [data.courseId] });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.generateExample(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const translateVocabularyDraftExample = createServerFn({
  method: 'POST',
})
  .validator(decodeVocabularyTranslationRequest)
  .handler(async ({ data }) => {
    const member = await requestMember({ courses: [data.courseId] });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.translateExample(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const suggestVocabularyTranslation = createServerFn({ method: 'POST' })
  .validator(decodeVocabularyTranslationSuggestion)
  .handler(async ({ data }) => {
    const member = await requestMember({
      courses: [data.courseId],
      books: [data.bookId],
      units: data.unitId === null ? [] : [data.unitId],
    });
    return vocabularyRuntime.runPromise(
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.suggestTranslation(data),
      ).pipe(billedTo(member.userId)),
    );
  });
