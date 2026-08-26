import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { Effect } from 'effect';
import { requireSession } from '../../shared/auth/require-session';
import { requireString } from '../../shared/validate/input';
import { CourseNotFoundError } from './errors/course-not-found-error';
import { PageNotFoundError } from './errors/page-not-found-error';
import { importRuntime } from './runtime';
import {
  retryPageAudio,
  serializableAudioReport,
} from './services/audio-generation';
import { audioRecoveryPages } from './services/audio-recovery-query';
import { retryPendingExtraction } from './services/extraction-retry';
import { ImportRepository } from './services/repository';

const authenticated = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.zipRight(requireSession(getRequest().headers), effect);

export const listCourses = createServerFn().handler(() =>
  importRuntime.runPromise(
    authenticated(
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        return yield* repository.listOrSeedCourses;
      }),
    ),
  ),
);

export const getCourse = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      authenticated(
        Effect.gen(function* () {
          const repository = yield* ImportRepository;
          const course = yield* repository.getCourse(data);
          return course === undefined
            ? yield* new CourseNotFoundError({
                message: 'Kurs nicht gefunden.',
              })
            : course;
        }),
      ),
    ),
  );

export const listPendingPages = createServerFn().handler(() =>
  importRuntime.runPromise(
    authenticated(
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        return yield* repository.listPendingPages;
      }),
    ),
  ),
);

export const listAudioRecoveryPages = createServerFn().handler(() =>
  importRuntime.runPromise(authenticated(audioRecoveryPages)),
);

export const getPage = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      authenticated(
        Effect.gen(function* () {
          const repository = yield* ImportRepository;
          const row = yield* repository.getPage(data);
          if (row === undefined) {
            return yield* new PageNotFoundError({
              message: 'Seite nicht gefunden.',
            });
          }
          return {
            page: {
              ...row.page,
              extraction: row.page.extraction as ExtractionResult | null,
            },
            course: row.course,
            units: yield* repository.listUnits(row.page.courseId),
          };
        }),
      ),
    ),
  );

export const retryExtraction = createServerFn({ method: 'POST' })
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      authenticated(
        retryPendingExtraction(data).pipe(
          Effect.map((updated) => ({
            ...updated,
            extraction: updated.extraction as ExtractionResult | null,
          })),
        ),
      ),
    ),
  );

export const retryAudio = createServerFn({ method: 'POST' })
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      authenticated(
        retryPageAudio(data).pipe(Effect.map(serializableAudioReport)),
      ),
    ),
  );
