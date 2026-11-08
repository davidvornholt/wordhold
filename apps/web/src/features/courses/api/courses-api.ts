import { type AddEntryPayload, WordholdApi } from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import { NotFound } from '@wordhold/api/errors';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { billedTo } from '../../../shared/ai/usage-ledger';
import { runIn } from '../../../shared/api/api-failure';
import { CreateTermEntry } from '../schemas/term-entry-creation';
import { CreateTextEntry } from '../schemas/text-entry-changes';
import { CreateVocabularyEntry } from '../schemas/vocabulary-entry-creation';
import {
  termRuntime,
  textRuntime,
  vocabularyRuntime,
} from '../services/course-runtimes';
import { TermEntryService } from '../services/term-entry-service';
import { TextEntryService } from '../services/text-entry-service';
import { VocabularyEntryService } from '../services/vocabulary-entry-service';
import { byDifficulty, matchesFilter } from '../ui/vocabulary-filter-logic';
import {
  courseEntry,
  courseOutline,
  courseVocabulary,
  foundExample,
  memberCourse,
  notInSubjects,
  wordPlace,
} from './course-api-work';
import type { ApiCourse } from './course-records';
import { toApiEntry, toApiOutline } from './entry-wire';

type Member = CurrentMember['Service'];

const addWord = (member: Member, course: ApiCourse, payload: AddEntryPayload) =>
  Effect.gen(function* () {
    const [, outline] = yield* courseOutline(course.id);
    const place = yield* wordPlace(outline, payload);
    const create = Schema.decodeUnknownEffect(CreateVocabularyEntry)({
      courseId: course.id,
      ...place,
      targetText: payload.targetText,
      nativeText: payload.nativeText,
      ...(payload.example === undefined
        ? {}
        : { example: foundExample(payload.example) }),
    }).pipe(
      Effect.flatMap((input) =>
        Effect.flatMap(VocabularyEntryService, (service) =>
          service.create(input),
        ),
      ),
      billedTo(member.userId),
    );
    return yield* runIn(vocabularyRuntime, create);
  });

// A term is its definition's title, and a text's title stands for the text,
// so both take the two texts of the payload and nothing else.
const addSubjectEntry = (course: ApiCourse, payload: AddEntryPayload) =>
  Effect.gen(function* () {
    if (
      payload.bookId !== undefined ||
      payload.unitId !== undefined ||
      payload.example !== undefined
    ) {
      return yield* notInSubjects;
    }
    const created =
      course.kind === 'terms'
        ? yield* runIn(
            termRuntime,
            Schema.decodeUnknownEffect(CreateTermEntry)({
              courseId: course.id,
              term: payload.targetText,
              definition: payload.nativeText,
            }).pipe(
              Effect.flatMap((input) =>
                Effect.flatMap(TermEntryService, (service) =>
                  service.create(input),
                ),
              ),
            ),
          )
        : yield* runIn(
            textRuntime,
            Schema.decodeUnknownEffect(CreateTextEntry)({
              courseId: course.id,
              title: payload.targetText,
              text: payload.nativeText,
            }).pipe(
              Effect.flatMap((input) =>
                Effect.flatMap(TextEntryService, (service) =>
                  service.create(input),
                ),
              ),
            ),
          );
    return { entryId: created.entryId, audio: null };
  });

export const coursesApi = HttpApiBuilder.group(
  WordholdApi,
  'courses',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle('get', ({ params }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const course = yield* memberCourse(member, params.id);
            const [directions, outline] = yield* courseOutline(course.id);
            return toApiOutline(course, directions, outline);
          }),
        )
        .handle('entries', ({ params, query }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const course = yield* memberCourse(member, params.id);
            if (
              course.kind !== 'language' &&
              (query.book !== undefined || query.unit !== undefined)
            ) {
              return yield* notInSubjects;
            }
            const [directions, outline] = yield* courseOutline(course.id);
            if (
              (query.book !== undefined &&
                !outline.books.some(({ id }) => id === query.book)) ||
              (query.unit !== undefined &&
                !outline.units.some(({ id }) => id === query.unit))
            ) {
              return yield* new NotFound({
                message: 'This course has no such book or unit.',
              });
            }
            const now = new Date();
            const { filter } = query;
            const entries = (yield* courseVocabulary(course.id)).filter(
              (entry) =>
                (query.book === undefined || entry.bookId === query.book) &&
                (query.unit === undefined || entry.unitId === query.unit) &&
                (filter === undefined ||
                  matchesFilter(entry, directions, filter, now)),
            );
            const ordered =
              filter === 'difficult'
                ? entries.toSorted(byDifficulty(directions))
                : entries;
            return ordered.map((entry) => toApiEntry(course, entry));
          }),
        )
        .handle('add', ({ params, payload }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            const course = yield* memberCourse(member, params.id);
            const saved =
              course.kind === 'language'
                ? yield* addWord(member, course, payload)
                : yield* addSubjectEntry(course, payload);
            const entry = yield* courseEntry(course, saved.entryId);
            return { entry: toApiEntry(course, entry), audio: saved.audio };
          }),
        ),
    ),
);
