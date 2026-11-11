import {
  type EditEntryPayload,
  searchLimit,
  WordholdApi,
} from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { billedTo } from '../../../shared/ai/usage-ledger';
import { runIn } from '../../../shared/api/api-failure';
import { authRuntime } from '../../../shared/auth/runtime';
import type { VocabularyEntry } from '../schemas/course-units';
import {
  UpdateTermEntry,
  UpdateVocabularyEntry,
} from '../schemas/entry-changes';
import { UpdateTextEntry } from '../schemas/text-entry-changes';
import {
  termRuntime,
  textRuntime,
  vocabularyRuntime,
} from '../services/course-runtimes';
import { TermEntryService } from '../services/term-entry-service';
import { TextEntryService } from '../services/text-entry-service';
import { VocabularyEntryService } from '../services/vocabulary-entry-service';
import {
  courseEntry,
  courseVocabulary,
  foundExample,
  keptExample,
  memberCourse,
  memberEntryCourse,
  notInSubjects,
  relatedWordsAfterEdit,
} from './course-api-work';
import { type ApiCourse, ownedCourses } from './course-records';
import { searchEntries, toApiEntry } from './entry-wire';

type Member = CurrentMember['Service'];

const editedExample = (current: VocabularyEntry, payload: EditEntryPayload) => {
  if (payload.example === undefined) {
    return keptExample(current.example);
  }
  return payload.example === null ? undefined : foundExample(payload.example);
};

// The entries of one course, each with the course it belongs to.
const courseCandidates = (course: ApiCourse) =>
  Effect.map(courseVocabulary(course.id), (entries) =>
    entries.map((entry) => ({ course, entry })),
  );

const editWord = (
  member: Member,
  current: VocabularyEntry,
  courseId: string,
  payload: EditEntryPayload,
) => {
  const example = editedExample(current, payload);
  const targetText = payload.targetText ?? current.targetText;
  const update = Schema.decodeUnknownEffect(UpdateVocabularyEntry)({
    courseId,
    entryId: current.id,
    targetText,
    nativeText: payload.nativeText ?? current.nativeText,
    ...(example === undefined ? {} : { example }),
    synonyms: relatedWordsAfterEdit(
      current.synonyms,
      payload.synonyms,
      targetText,
    ),
    antonyms: relatedWordsAfterEdit(
      current.antonyms,
      payload.antonyms,
      targetText,
    ),
  }).pipe(
    Effect.flatMap((input) =>
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.update(input),
      ),
    ),
    billedTo(member.userId),
  );
  return Effect.map(runIn(vocabularyRuntime, update), ({ audio }) => audio);
};

const editSubjectEntry = (
  current: VocabularyEntry,
  course: ApiCourse,
  payload: EditEntryPayload,
) =>
  Effect.gen(function* () {
    if (
      payload.example !== undefined ||
      payload.synonyms !== undefined ||
      payload.antonyms !== undefined
    ) {
      return yield* notInSubjects;
    }
    const targetText = payload.targetText ?? current.targetText;
    const nativeText = payload.nativeText ?? current.nativeText;
    if (course.kind === 'terms') {
      yield* runIn(
        termRuntime,
        Schema.decodeUnknownEffect(UpdateTermEntry)({
          courseId: course.id,
          entryId: current.id,
          term: targetText,
          definition: nativeText,
        }).pipe(
          Effect.flatMap((input) =>
            Effect.flatMap(TermEntryService, (service) =>
              service.update(input),
            ),
          ),
        ),
      );
    } else {
      yield* runIn(
        textRuntime,
        Schema.decodeUnknownEffect(UpdateTextEntry)({
          courseId: course.id,
          entryId: current.id,
          title: targetText,
          text: nativeText,
        }).pipe(
          Effect.flatMap((input) =>
            Effect.flatMap(TextEntryService, (service) =>
              service.update(input),
            ),
          ),
        ),
      );
    }
    return null;
  });

export const entriesApi = HttpApiBuilder.group(
  WordholdApi,
  'entries',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle('search', ({ query }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const courses =
              query.course === undefined
                ? yield* runIn(authRuntime, ownedCourses(member.userId))
                : [yield* memberCourse(member, query.course)];
            const candidates = yield* Effect.forEach(courses, courseCandidates);
            return searchEntries(
              candidates.flat(),
              query.query,
              searchLimit,
            ).map(({ course, entry }) => toApiEntry(course, entry));
          }),
        )
        .handle('get', ({ params }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const course = yield* memberEntryCourse(member, params.id);
            return toApiEntry(course, yield* courseEntry(course, params.id));
          }),
        )
        .handle('edit', ({ params, payload }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const course = yield* memberEntryCourse(member, params.id);
            const current = yield* courseEntry(course, params.id);
            const audio =
              course.kind === 'language'
                ? yield* editWord(member, current, course.id, payload)
                : yield* editSubjectEntry(current, course, payload);
            const entry = yield* courseEntry(course, params.id);
            return { entry: toApiEntry(course, entry), audio };
          }),
        ),
    ),
);
