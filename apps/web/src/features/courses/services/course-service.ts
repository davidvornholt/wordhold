import { Clock, Effect } from 'effect';
import {
  CourseSettingsNotFoundError,
  CourseUnitConflictError,
  CourseUnitOrderChangedError,
} from '../errors/courses-errors';
import type {
  CourseDirectionsData,
  SetCourseDirectionsData,
} from '../schemas/course-directions';
import type {
  CreateCourseUnitData,
  ReorderCourseUnitsData,
} from '../schemas/course-unit-management';
import { CourseStore } from './course-store';

const notFound = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
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
      const listUnits = (courseId: string) =>
        Effect.flatMap(Clock.currentTimeMillis, (now) =>
          store.listUnits(courseId, new Date(now)),
        );
      const createUnit = ({ courseId, name }: CreateCourseUnitData) =>
        Effect.gen(function* () {
          const result = yield* store.createUnit(courseId, name);
          if (result === 'course-missing') {
            return yield* notFound;
          }
          if (result === 'duplicate') {
            return yield* new CourseUnitConflictError({
              message: `Die Einheit "${name}" gibt es bereits.`,
            });
          }
          return yield* listUnits(courseId);
        });
      const reorderUnits = ({
        courseId,
        expectedUnitIds,
        unitIds,
      }: ReorderCourseUnitsData) =>
        Effect.gen(function* () {
          const updated = yield* store.reorderUnits(
            courseId,
            expectedUnitIds,
            unitIds,
          );
          if (!updated) {
            return yield* new CourseUnitOrderChangedError({
              message:
                'Die Einheiten wurden zwischenzeitlich geändert. Lade die Seite neu und versuche es noch einmal.',
            });
          }
          return yield* listUnits(courseId);
        });
      const listVocabulary = (courseId: string) =>
        store.listVocabulary(courseId);
      return {
        getDirections,
        setDirections,
        listUnits,
        createUnit,
        reorderUnits,
        listVocabulary,
      } as const;
    }),
  },
) {}
