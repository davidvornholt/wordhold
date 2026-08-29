import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
import { decodeSetCourseDirections } from '../schemas/course-directions';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';

const courseLive = CourseService.Default.pipe(
  Layer.provide(CourseStore.live.pipe(Layer.provide(PgLive))),
);

const courseRuntime = ManagedRuntime.make(courseLive);

const decodeId = Schema.decodeUnknownSync(Schema.UUID);

export const getCourseDirections = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.getDirections(courseId),
      ),
    );
  });

export const setCourseDirections = createServerFn({ method: 'POST' })
  .validator(decodeSetCourseDirections)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.setDirections(data)),
    );
  });

export const listCourseUnits = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.listUnits(courseId)),
    );
  });

export const listUnitEntries = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: unitId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) => service.listEntries(unitId)),
    );
  });

export const listCourseVocabulary = createServerFn()
  .validator(decodeId)
  .handler(async ({ data: courseId }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return courseRuntime.runPromise(
      Effect.flatMap(CourseService, (service) =>
        service.listVocabulary(courseId),
      ),
    );
  });
