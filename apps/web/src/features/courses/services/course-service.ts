import { Clock, Context, Effect, Layer } from 'effect';
import { isListCourse } from '../../../shared/directions';
import type { CourseDatabaseError } from '../errors/courses-errors';
import {
  CourseBookConflictError,
  CourseBookNotFoundError,
  CourseKindMismatchError,
  CourseSettingsNotFoundError,
  CourseUnitConflictError,
  CourseUnitOrderChangedError,
  SubjectConflictError,
} from '../errors/courses-errors';
import type {
  CourseDirectionsData,
  SetCourseDirectionsData,
} from '../schemas/course-directions';
import type {
  CreateCourseBookData,
  CreateCourseUnitData,
  RenameCourseBookData,
  ReorderCourseUnitsData,
} from '../schemas/course-unit-management';
import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  VocabularyEntry,
} from '../schemas/course-units';
import type {
  CreateSubjectData,
  RenameSubjectData,
} from '../schemas/subject-management';
import { CourseStore } from './course-store';

const notFound = new CourseSettingsNotFoundError({
  message: 'Sprache, Fach oder Sammlung nicht gefunden.',
});

const subjectMissing = new CourseSettingsNotFoundError({
  message: 'Fach oder Sammlung nicht gefunden.',
});

const subjectTaken = (name: string) =>
  new SubjectConflictError({
    message: `„${name}“ gibt es auf der Übersicht bereits.`,
  });

const directionsFixed = new CourseKindMismatchError({
  message:
    'Ein Fach fragt immer vom Begriff zur Definition, eine Sammlung vom Titel zum Text.',
});

const noBooksInSubject = new CourseKindMismatchError({
  message:
    'Ein Fach oder eine Sammlung hat keine Bücher oder Einheiten. Trag die Einträge direkt auf ihrer Seite ein.',
});

const bookMissing = new CourseBookNotFoundError({
  message: 'Dieses Buch gibt es nicht mehr. Lade die Seite neu.',
});

const bookTaken = (name: string) =>
  new CourseBookConflictError({
    message: `Das Buch "${name}" gibt es bereits.`,
  });

// The settings a language and a subject differ in: a language chooses its
// directions, a subject or collection is created and renamed from the
// overview.
const courseSettings = (store: CourseStore['Service']) => {
  // Switching a direction off only stops it being asked, counted and
  // scheduled. Its cards keep their schedule, so switching it back on
  // resumes where it left off instead of starting the entries over. A
  // subject or collection has only the one direction.
  const setDirections = ({ courseId, directions }: SetCourseDirectionsData) =>
    Effect.gen(function* () {
      const kind = yield* store.readKind(courseId);
      if (kind === undefined) {
        return yield* notFound;
      }
      if (isListCourse(kind)) {
        return yield* directionsFixed;
      }
      const updated = yield* store.writeDirections(courseId, directions);
      return updated ? directions : yield* notFound;
    });
  const createSubject = (ownerId: string, { name, kind }: CreateSubjectData) =>
    Effect.gen(function* () {
      const result = yield* store.createSubject(ownerId, name, kind);
      return result.kind === 'duplicate'
        ? yield* subjectTaken(name)
        : { courseId: result.courseId };
    });
  const renameSubject = ({ courseId, name }: RenameSubjectData) =>
    Effect.gen(function* () {
      const result = yield* store.renameSubject(courseId, name);
      if (result === 'subject-missing') {
        return yield* subjectMissing;
      }
      if (result === 'duplicate') {
        return yield* subjectTaken(name);
      }
      return { name };
    });
  return { setDirections, createSubject, renameSubject } as const;
};

export class CourseService extends Context.Service<
  CourseService,
  {
    readonly getDirections: (
      courseId: string,
    ) => Effect.Effect<
      ReadonlyArray<'to_target' | 'to_native'>,
      CourseDatabaseError | CourseSettingsNotFoundError
    >;
    readonly setDirections: (
      input: SetCourseDirectionsData,
    ) => Effect.Effect<
      ReadonlyArray<'to_target' | 'to_native'>,
      | CourseDatabaseError
      | CourseSettingsNotFoundError
      | CourseKindMismatchError
    >;
    readonly createSubject: (
      ownerId: string,
      { name, kind }: CreateSubjectData,
    ) => Effect.Effect<
      { courseId: string },
      CourseDatabaseError | SubjectConflictError
    >;
    readonly renameSubject: (
      input: RenameSubjectData,
    ) => Effect.Effect<
      { name: string },
      CourseDatabaseError | CourseSettingsNotFoundError | SubjectConflictError
    >;
    readonly getOutline: (
      courseId: string,
    ) => Effect.Effect<
      { books: ReadonlyArray<CourseBook>; units: ReadonlyArray<CourseUnit> },
      CourseDatabaseError
    >;
    readonly createBook: (
      input: CreateCourseBookData,
    ) => Effect.Effect<
      { bookId: string },
      | CourseDatabaseError
      | CourseSettingsNotFoundError
      | CourseKindMismatchError
      | CourseBookConflictError
    >;
    readonly renameBook: (
      input: RenameCourseBookData,
    ) => Effect.Effect<
      { books: ReadonlyArray<CourseBook>; units: ReadonlyArray<CourseUnit> },
      | CourseDatabaseError
      | CourseKindMismatchError
      | CourseBookConflictError
      | CourseBookNotFoundError
    >;
    readonly createUnit: (
      input: CreateCourseUnitData,
    ) => Effect.Effect<
      { books: ReadonlyArray<CourseBook>; units: ReadonlyArray<CourseUnit> },
      | CourseDatabaseError
      | CourseKindMismatchError
      | CourseBookNotFoundError
      | CourseUnitConflictError
    >;
    readonly reorderUnits: (
      input: ReorderCourseUnitsData,
    ) => Effect.Effect<
      { books: ReadonlyArray<CourseBook>; units: ReadonlyArray<CourseUnit> },
      | CourseDatabaseError
      | CourseKindMismatchError
      | CourseUnitOrderChangedError
    >;
    readonly listVocabulary: (
      courseId: string,
    ) => Effect.Effect<ReadonlyArray<VocabularyEntry>, CourseDatabaseError>;
  }
>()('wordhold/CourseService') {
  static readonly layer = Layer.effect(
    CourseService,
    Effect.gen(function* () {
      const store = yield* CourseStore;
      const { setDirections, createSubject, renameSubject } =
        courseSettings(store);
      const getDirections = (courseId: string) =>
        Effect.flatMap(
          store.readDirections(courseId),
          (
            directions,
          ): Effect.Effect<
            CourseDirectionsData,
            CourseSettingsNotFoundError
          > =>
            directions === undefined
              ? Effect.fail(notFound)
              : Effect.succeed(directions),
        );
      const getOutline = (courseId: string) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const [books, units] = yield* Effect.all([
            store.listBooks(courseId, now),
            store.listUnits(courseId, now),
          ]);
          return { books, units } satisfies CourseOutline;
        });
      // A subject or collection keeps its entries in one list, so only a
      // language course has books and units to manage. A course never
      // changes its kind, so checking it before the mutation cannot race.
      const requireLanguage = (courseId: string) =>
        Effect.gen(function* () {
          const kind = yield* store.readKind(courseId);
          if (kind !== undefined && isListCourse(kind)) {
            return yield* noBooksInSubject;
          }
        });
      const createBook = ({ courseId, name }: CreateCourseBookData) =>
        Effect.gen(function* () {
          yield* requireLanguage(courseId);
          const result = yield* store.createBook(courseId, name);
          if (result.kind === 'course-missing') {
            return yield* notFound;
          }
          if (result.kind === 'duplicate') {
            return yield* bookTaken(name);
          }
          return { bookId: result.bookId };
        });
      const renameBook = ({ courseId, bookId, name }: RenameCourseBookData) =>
        Effect.gen(function* () {
          yield* requireLanguage(courseId);
          const result = yield* store.renameBook(courseId, bookId, name);
          if (result === 'book-missing') {
            return yield* bookMissing;
          }
          if (result === 'duplicate') {
            return yield* bookTaken(name);
          }
          return yield* getOutline(courseId);
        });
      const createUnit = ({ courseId, bookId, name }: CreateCourseUnitData) =>
        Effect.gen(function* () {
          yield* requireLanguage(courseId);
          const result = yield* store.createUnit(courseId, bookId, name);
          if (result === 'book-missing') {
            return yield* bookMissing;
          }
          if (result === 'duplicate') {
            return yield* new CourseUnitConflictError({
              message: `Die Einheit "${name}" gibt es in diesem Buch bereits.`,
            });
          }
          return yield* getOutline(courseId);
        });
      const reorderUnits = ({
        courseId,
        bookId,
        expectedUnitIds,
        unitIds,
      }: ReorderCourseUnitsData) =>
        Effect.gen(function* () {
          yield* requireLanguage(courseId);
          const updated = yield* store.reorderUnits(
            courseId,
            bookId,
            expectedUnitIds,
            unitIds,
          );
          if (!updated) {
            return yield* new CourseUnitOrderChangedError({
              message:
                'Die Einheiten wurden zwischenzeitlich geändert. Lade die Seite neu und versuche es noch einmal.',
            });
          }
          return yield* getOutline(courseId);
        });
      const listVocabulary = (courseId: string) =>
        store.listVocabulary(courseId);
      return CourseService.of({
        getDirections,
        setDirections,
        createSubject,
        renameSubject,
        getOutline,
        createBook,
        renameBook,
        createUnit,
        reorderUnits,
        listVocabulary,
      });
    }),
  );
}
