import { Clock, Effect } from 'effect';
import { CourseSettingsNotFoundError } from '../errors/courses-errors';
import type {
  CourseDirectionsData,
  SetCourseDirectionsData,
} from '../schemas/course-directions';
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
      const listVocabulary = (courseId: string) =>
        store.listVocabulary(courseId);
      return {
        getDirections,
        setDirections,
        listUnits,
        listVocabulary,
      } as const;
    }),
  },
) {}
