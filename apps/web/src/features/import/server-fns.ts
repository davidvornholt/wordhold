import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Cause, Effect } from 'effect';
import { sentenceRuntime } from '../../shared/ai/runtime';
import { requireSession } from '../../shared/auth/require-session';
import { englishNames } from '../../shared/languages';
import { requireString } from '../../shared/validate/input';
import { decodeGeneratedExample } from '../../shared/vocabulary/entry-fields';
import { CourseNotFoundError } from './errors/course-not-found-error';
import { ExampleGenerationError } from './errors/example-generation-error';
import { ImportSessionNotFoundError } from './errors/import-session-not-found-error';
import { PageNotFoundError } from './errors/page-not-found-error';
import { importRuntime } from './runtime';
import {
  decodeExampleRequest,
  decodeTranslationRequest,
} from './schemas/example-request';
import {
  retryPageAudio,
  serializableAudioReport,
} from './services/audio-generation';
import { audioRecoveryPages } from './services/audio-recovery-query';
import { discardPendingImportSession } from './services/discard-page';
import { retryPendingExtraction } from './services/extraction-retry';
import { ImportRepository } from './services/repository';

// Log nested error messages before a failure leaves the server:
// the learner sees the typed message, the log keeps the provider diagnostic.
const authenticated = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.zipRight(requireSession(getRequest().headers), effect).pipe(
    Effect.tapErrorCause((cause) =>
      Effect.logError(
        'import request failed',
        Cause.pretty(cause, { renderErrorCause: true }),
      ),
    ),
  );

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

export const listPendingImportSessions = createServerFn().handler(() =>
  importRuntime.runPromise(
    authenticated(
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        return yield* repository.listPendingImportSessions;
      }),
    ),
  ),
);

export const getImportSession = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      authenticated(
        Effect.gen(function* () {
          const repository = yield* ImportRepository;
          const session = yield* repository.getImportSession(data);
          return session === undefined
            ? yield* new ImportSessionNotFoundError({
                message: 'Import nicht gefunden.',
              })
            : session;
        }),
      ),
    ),
  );

export const listAudioRecoveryPages = createServerFn().handler(() =>
  importRuntime.runPromise(authenticated(audioRecoveryPages)),
);

export const discardImportSession = createServerFn({ method: 'POST' })
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(authenticated(discardPendingImportSession(data))),
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
            books: yield* repository.listBooks(row.page.courseId),
            units: yield* repository.listUnits(row.page.courseId),
            unitEntries: yield* repository.listUnitEntries(row.page.courseId),
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

// A draft can only be worked on while its page awaits verification.
const editablePage = (pageId: string) =>
  importRuntime.runPromise(
    authenticated(
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        const found = yield* repository.getPage(pageId);
        if (
          found === undefined ||
          found.page.status !== 'awaiting_verification'
        ) {
          return yield* new PageNotFoundError({
            message: 'Diese Seite kann nicht mehr bearbeitet werden.',
          });
        }
        return found;
      }),
    ),
  );

// Fills the German translation of a printed example the extraction did not
// deliver, or that the learner rewrote during review.
export const translateDraftExample = createServerFn({ method: 'POST' })
  .validator(decodeTranslationRequest)
  .handler(async ({ data }) => {
    const page = await editablePage(data.pageId);
    return sentenceRuntime.runPromise(
      Effect.gen(function* () {
        const generator = yield* SentenceGen;
        const translated = yield* generator.translate({
          targetText: data.targetText,
          targetLanguage: englishNames[page.course.targetLanguage],
        });
        return { native: translated.native };
      }),
    );
  });

export const generateDraftExample = createServerFn({ method: 'POST' })
  .validator(decodeExampleRequest)
  .handler(async ({ data }) => {
    const page = await editablePage(data.pageId);
    return sentenceRuntime.runPromise(
      Effect.gen(function* () {
        const generator = yield* SentenceGen;
        const batch = yield* generator.generate({
          targetText: data.targetText,
          nativeText: data.nativeText,
          targetLanguage: englishNames[page.course.targetLanguage],
          count: 1,
        });
        const [generated] = batch.sentences;
        if (generated === undefined) {
          return yield* new ExampleGenerationError({
            message: 'Der Sprachdienst hat keinen Beispielsatz geliefert.',
          });
        }
        return yield* decodeGeneratedExample(generated).pipe(
          Effect.mapError(
            () =>
              new ExampleGenerationError({
                message: 'Der erzeugte Beispielsatz ist ungültig.',
              }),
          ),
        );
      }),
    );
  });
