import type { CurrentMember } from '@wordhold/api/current-member';
import { NotFound, Rejected } from '@wordhold/api/errors';
import { Effect } from 'effect';
import { runIn } from '../../../shared/api/api-failure';
import { authRuntime } from '../../../shared/auth/runtime';
import type { NewExampleData } from '../../../shared/vocabulary/entry-fields';
import { distinctRelatedWords } from '../../../shared/vocabulary/related-words';
import type {
  CourseOutline,
  CourseUnit,
  VocabularyExample,
} from '../schemas/course-units';
import { courseRuntime } from '../services/course-runtimes';
import { CourseService } from '../services/course-service';
import {
  lastUsedWordPlace,
  type WordPlace,
  wordPlaceOptions,
} from '../ui/word-places';
import { type ApiCourse, entryCourse, ownedCourse } from './course-records';

type Member = CurrentMember['Service'];

export const memberCourse = (member: Member, courseId: string) =>
  runIn(authRuntime, ownedCourse(member.userId, courseId));

export const memberEntryCourse = (member: Member, entryId: string) =>
  runIn(authRuntime, entryCourse(member.userId, entryId));

export const courseOutline = (courseId: string) =>
  runIn(
    courseRuntime,
    Effect.flatMap(CourseService, (service) =>
      Effect.all([
        service.getDirections(courseId),
        service.getOutline(courseId),
      ]),
    ),
  );

export const courseVocabulary = (courseId: string) =>
  runIn(
    courseRuntime,
    Effect.flatMap(CourseService, (service) =>
      service.listVocabulary(courseId),
    ),
  );

export const courseEntry = (course: ApiCourse, entryId: string) =>
  Effect.flatMap(courseVocabulary(course.id), (entries) => {
    const entry = entries.find((candidate) => candidate.id === entryId);
    return entry === undefined
      ? Effect.fail(new NotFound({ message: 'Nicht gefunden.' }))
      : Effect.succeed(entry);
  });

export const notInSubjects = new Rejected({
  message:
    'Terms and texts have no books, units, example sentences, synonyms or antonyms. Leave those out.',
});

export const relatedWordsAfterEdit = (
  stored: ReadonlyArray<string> | null,
  given: ReadonlyArray<string> | undefined,
  word: string,
): ReadonlyArray<string> | null =>
  given === undefined ? stored : distinctRelatedWords(given, word);

/**
 * An example given through the API is one the owner came across unless the
 * request marks it as written by AI.
 */
export const givenExample = (example: {
  readonly targetText: string;
  readonly nativeText?: string | undefined;
  readonly source?: NewExampleData['source'] | undefined;
}): NewExampleData => ({
  targetText: example.targetText,
  ...(example.nativeText === undefined
    ? {}
    : { nativeText: example.nativeText }),
  source: example.source ?? 'textbook',
});

/** A stored example, given back unchanged so an edit keeps it and its audio. */
export const keptExample = (
  example: VocabularyExample | null,
): NewExampleData | undefined =>
  example === null
    ? undefined
    : {
        targetText: example.targetText,
        ...(example.nativeText === null
          ? {}
          : { nativeText: example.nativeText }),
        source: example.source,
      };

/**
 * The unit a request created, read from the outline after the creation.
 * Another request may add a unit to the course before that read, so the unit
 * is found by its book and name, which no other unit in that book shares.
 */
export const createdUnit = (
  outline: CourseOutline,
  created: { readonly bookId: string; readonly name: string },
): CourseUnit | undefined =>
  outline.units.find(
    ({ bookId, name }) => bookId === created.bookId && name === created.name,
  );

type PlaceRequest = {
  readonly bookId?: string | undefined;
  readonly unitId?: string | undefined;
};

/**
 * Where a new word goes: the unit or book asked for, or else the place the
 * course's last word went, as the app's form proposes.
 */
export const wordPlace = (
  outline: CourseOutline,
  request: PlaceRequest,
): Effect.Effect<WordPlace, NotFound | Rejected> => {
  if (request.unitId !== undefined) {
    const unit = outline.units.find(({ id }) => id === request.unitId);
    if (unit === undefined) {
      return Effect.fail(
        new NotFound({ message: 'This course has no such unit.' }),
      );
    }
    if (request.bookId !== undefined && request.bookId !== unit.bookId) {
      return Effect.fail(
        new Rejected({ message: 'The unit is not in that book.' }),
      );
    }
    return Effect.succeed({ bookId: unit.bookId, unitId: unit.id });
  }
  if (request.bookId !== undefined) {
    const book = outline.books.find(({ id }) => id === request.bookId);
    return book === undefined
      ? Effect.fail(new NotFound({ message: 'This course has no such book.' }))
      : Effect.succeed({ bookId: book.id, unitId: null });
  }
  const last = lastUsedWordPlace(wordPlaceOptions(outline));
  return last === undefined
    ? Effect.fail(
        new Rejected({
          message: 'The course has no book yet. Add one in the app first.',
        }),
      )
    : Effect.succeed(last.place);
};
