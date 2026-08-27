import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import { decodeSetCourseDirections } from '../schemas/course-directions';
import { CourseDirectionsStore } from './course-directions-store';
import { CourseSettingsService } from './course-settings-service';

const courseSettingsLive = CourseSettingsService.Default.pipe(
  Layer.provide(CourseDirectionsStore.live.pipe(Layer.provide(PgLive))),
);

const courseSettingsRuntime = ManagedRuntime.make(courseSettingsLive);

const decodeId = Schema.decodeUnknownSync(Schema.UUID);

export const getCourseDirections = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseSettingsRuntime.runPromise(
      Effect.flatMap(CourseSettingsService, (service) =>
        service.getDirections(courseId),
      ),
    );
  });

export const setCourseDirections = createServerFn({ method: 'POST' })
  .validator(decodeSetCourseDirections)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseSettingsRuntime.runPromise(
      Effect.flatMap(CourseSettingsService, (service) =>
        service.setDirections(data),
      ),
    );
  });
