import {
  type AddEntryPayload,
  type AddUnitPayload,
  type MoveEntriesPayload,
  WordholdApi,
} from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import { NotFound, ServerError } from '@wordhold/api/errors';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { billedTo } from '../../../shared/ai/usage-ledger';
import { runIn } from '../../../shared/api/api-failure';
import { CreateCourseUnit } from '../schemas/course-unit-management';
import { CreateTermEntry } from '../schemas/term-entry-creation';
import { CreateTextEntry } from '../schemas/text-entry-changes';
import { CreateVocabularyEntry } from '../schemas/vocabulary-entry-creation';
import {
  courseRuntime,
  termRuntime,
  textRuntime,
  vocabularyRuntime,
} from '../services/course-runtimes';
import { CourseService } from '../services/course-service';
import { TermEntryService } from '../services/term-entry-service';
import { TextEntryService } from '../services/text-entry-service';
import { VocabularyEntryService } from '../services/vocabulary-entry-service';
import { byDifficulty, matchesFilter } from '../ui/vocabulary-filter-logic';
import {
  courseEntry,
  courseOutline,
  courseVocabulary,
  createdUnit,
  foundExample,
  memberCourse,
  notInSubjects,
  wordPlace,
} from './course-api-work';
import type { ApiCourse } from './course-records';
import { toApiEntry, toApiOutline, toApiUnit } from './entry-wire';

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

const requireLanguage = (course: ApiCourse) =>
  course.kind === 'language' ? Effect.void : Effect.fail(notInSubjects);

const addUnit = (course: ApiCourse, payload: AddUnitPayload) =>
  Effect.gen(function* () {
    yield* requireLanguage(course);
    const [, outline] = yield* courseOutline(course.id);
    if (!outline.books.some(({ id }) => id === payload.bookId)) {
      return yield* new NotFound({ message: 'This course has no such book.' });
    }
    const unit = yield* runIn(
      courseRuntime,
      Effect.gen(function* () {
        const input = yield* Schema.decodeUnknownEffect(CreateCourseUnit)({
          courseId: course.id,
          bookId: payload.bookId,
          name: payload.name,
        });
        const service = yield* CourseService;
        return createdUnit(yield* service.createUnit(input), input);
      }),
    );
    return unit === undefined
      ? yield* new ServerError({ message: 'The new unit could not be read.' })
      : toApiUnit(unit);
  });

const moveWords = (course: ApiCourse, payload: MoveEntriesPayload) =>
  Effect.gen(function* () {
    yield* requireLanguage(course);
    const [, outline] = yield* courseOutline(course.id);
    // The payload names a unit or a book, so this is never the place of the
    // course's last word.
    const place = yield* wordPlace(outline, payload);
    const known = new Set(
      (yield* courseVocabulary(course.id)).map(({ id }) => id),
    );
    const strangers = payload.entryIds.filter((id) => !known.has(id));
    if (strangers.length > 0) {
      return yield* new NotFound({
        message: `This course has no entry ${strangers.join(', ')}. Nothing was moved.`,
      });
    }
    yield* runIn(
      vocabularyRuntime,
      Effect.flatMap(VocabularyEntryService, (service) =>
        service.move({
          courseId: course.id,
          entryIds: payload.entryIds,
          ...place,
        }),
      ),
    );
    const moved = new Set(payload.entryIds);
    return (yield* courseVocabulary(course.id))
      .filter(({ id }) => moved.has(id))
      .map((entry) => toApiEntry(course, entry));
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
        )
        .handle('move', ({ params, payload }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            return yield* moveWords(
              yield* memberCourse(member, params.id),
              payload,
            );
          }),
        )
        .handle('addUnit', ({ params, payload }) =>
          Effect.gen(function* () {
            const member = yield* CurrentMember;
            return yield* addUnit(
              yield* memberCourse(member, params.id),
              payload,
            );
          }),
        ),
    ),
);
