import { Clock, type Context, Effect } from 'effect';
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
import type { CourseOutline } from '../schemas/course-units';
import type {
  CreateSubjectData,
  RenameSubjectData,
} from '../schemas/subject-management';
import { CourseStore } from './course-store';

const notFound = new CourseSettingsNotFoundError({
  message: 'Sprache oder Fach nicht gefunden.',
});

const subjectMissing = new CourseSettingsNotFoundError({
  message: 'Fach nicht gefunden.',
});

const subjectTaken = (name: string) =>
  new SubjectConflictError({
    message: `„${name}“ gibt es auf der Übersicht bereits.`,
  });

const directionsFixed = new CourseKindMismatchError({
  message: 'Ein Fach fragt immer vom Begriff zur Definition.',
});

const bookMissing = new CourseBookNotFoundError({
  message: 'Dieses Buch gibt es nicht mehr. Lade die Seite neu.',
});

const bookTaken = (name: string) =>
  new CourseBookConflictError({
    message: `Das Buch "${name}" gibt es bereits.`,
  });

// The settings a language and a subject differ in: a language chooses its
// directions, a subject is created and renamed from the overview.
const courseSettings = (store: Context.Tag.Service<typeof CourseStore>) => {
  // Switching a direction off only stops it being asked, counted and
  // scheduled. Its cards keep their schedule, so switching it back on
  // resumes where it left off instead of starting the entries over. A
  // subject has only the one direction.
  const setDirections = ({ courseId, directions }: SetCourseDirectionsData) =>
    Effect.gen(function* () {
      const kind = yield* store.readKind(courseId);
      if (kind === undefined) {
        return yield* notFound;
      }
      if (kind === 'terms') {
        return yield* directionsFixed;
      }
      const updated = yield* store.writeDirections(courseId, directions);
      return updated ? directions : yield* notFound;
    });
  const createSubject = ({ name }: CreateSubjectData) =>
    Effect.gen(function* () {
      const result = yield* store.createSubject(name);
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

export class CourseService extends Effect.Service<CourseService>()(
  'wordhold/CourseService',
  {
    effect: Effect.gen(function* () {
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
      const createBook = ({ courseId, name }: CreateCourseBookData) =>
        Effect.gen(function* () {
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
      return {
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
      } as const;
    }),
  },
) {}
