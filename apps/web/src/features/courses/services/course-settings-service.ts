import { Effect } from 'effect';
import { CourseSettingsNotFoundError } from '../errors/courses-errors';
import type {
  CourseDirectionsData,
  SetCourseDirectionsData,
} from '../schemas/course-directions';
import { CourseDirectionsStore } from './course-directions-store';

const notFound = new CourseSettingsNotFoundError({
  message: 'Kurs nicht gefunden.',
});

export class CourseSettingsService extends Effect.Service<CourseSettingsService>()(
  'wordhold/CourseSettingsService',
  {
    effect: Effect.gen(function* () {
      const store = yield* CourseDirectionsStore;
      const getDirections = (courseId: string) =>
        Effect.flatMap(
          store.read(courseId),
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
      // resumes where it left off instead of starting the words over.
      const setDirections = ({
        courseId,
        directions,
      }: SetCourseDirectionsData) =>
        Effect.flatMap(store.write(courseId, directions), (updated) =>
          updated ? Effect.succeed(directions) : Effect.fail(notFound),
        );
      return { getDirections, setDirections } as const;
    }),
  },
) {}
