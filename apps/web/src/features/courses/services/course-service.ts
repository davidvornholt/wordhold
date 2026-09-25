import { Clock, Effect } from 'effect';
import {
  CourseBookConflictError,
  CourseBookNotFoundError,
  CourseSettingsNotFoundError,
  CourseUnitConflictError,
  CourseUnitOrderChangedError,
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
import { CourseStore } from './course-store';

const notFound = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
});

const bookMissing = new CourseBookNotFoundError({
  message: 'Dieses Buch gibt es nicht mehr. Lade die Seite neu.',
});

const bookTaken = (name: string) =>
  new CourseBookConflictError({
    message: `Das Buch "${name}" gibt es bereits.`,
  });

export class CourseService extends Effect.Service<CourseService>()(
  'wordhold/CourseService',
  {
    effect: Effect.gen(function* () {
      const store = yield* CourseStore;
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
      // Switching a direction off only stops it being asked, counted and
      // scheduled. Its cards keep their schedule, so switching it back on
      // resumes where it left off instead of starting the entries over.
      const setDirections = ({
        courseId,
        directions,
      }: SetCourseDirectionsData) =>
        Effect.flatMap(
          store.writeDirections(courseId, directions),
          (updated) =>
            updated ? Effect.succeed(directions) : Effect.fail(notFound),
        );
      const getOutline = (courseId: string) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const [books, units] = yield* Effect.all([
            store.listBooks(courseId),
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
          return yield* getOutline(courseId);
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
