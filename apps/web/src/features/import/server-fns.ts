import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Cause, Effect } from 'effect';
import { sentenceRuntime } from '../../shared/ai/runtime';
import { billedTo } from '../../shared/ai/usage-ledger';
import type { Member } from '../../shared/auth/member-repository';
import type { OwnedReferences } from '../../shared/auth/ownership';
import { requireOwner } from '../../shared/auth/require-member';
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
import { decodePageRemovalRequest } from './schemas/page-removal';
import {
  retryPageAudio,
  serializableAudioReport,
} from './services/audio-generation';
import { audioRecoveryPages } from './services/audio-recovery-query';
import {
  discardPendingImportPage,
  discardPendingImportSession,
} from './services/discard-page';
import { retryPendingExtraction } from './services/extraction-retry';
import { ImportRepository } from './services/repository';

// Runs `effect` for the signed-in member once every record the request names
// is theirs, and bills its AI requests to them. Nested error messages are
// logged before a failure leaves the server: the learner sees the typed
// message, the log keeps the provider diagnostic.
const asMember = <A, E, R>(
  owned: OwnedReferences,
  effect: (member: Member) => Effect.Effect<A, E, R>,
) =>
  requireOwner(getRequest().headers, owned).pipe(
    Effect.flatMap((member) => effect(member).pipe(billedTo(member.userId))),
    Effect.tapCause((cause) =>
      Effect.logError('import request failed', Cause.pretty(cause)),
    ),
  );

export const listCourses = createServerFn().handler(() =>
  importRuntime.runPromise(
    asMember({}, (member) =>
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        return yield* repository.listOrSeedCourses(member.userId);
      }),
    ),
  ),
);

export const getCourse = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      asMember({ courses: [data] }, () =>
        Effect.gen(function* () {
          const repository = yield* ImportRepository;
          const course = yield* repository.getCourse(data);
          return course === undefined
            ? yield* new CourseNotFoundError({
                message: 'Sprache, Fach oder Sammlung nicht gefunden.',
              })
            : course;
        }),
      ),
    ),
  );

export const listPendingImportSessions = createServerFn().handler(() =>
  importRuntime.runPromise(
    asMember({}, (member) =>
      Effect.gen(function* () {
        const repository = yield* ImportRepository;
        return yield* repository.listPendingImportSessions(member.userId);
      }),
    ),
  ),
);

export const getImportSession = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      asMember({ importSessions: [data] }, () =>
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
  importRuntime.runPromise(
    asMember({}, (member) => audioRecoveryPages(member.userId)),
  ),
);

export const discardImportSession = createServerFn({ method: 'POST' })
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      asMember({ importSessions: [data] }, () =>
        discardPendingImportSession(data),
      ),
    ),
  );

// The batch may not exist on the server yet when every upload failed, so the
// course is what must be the learner's; the removal stays inside it.
export const removeImportPage = createServerFn({ method: 'POST' })
  .validator(decodePageRemovalRequest)
  .handler(({ data }) =>
    importRuntime.runPromise(
      asMember({ courses: [data.courseId] }, () =>
        discardPendingImportPage(data),
      ),
    ),
  );

export const getPage = createServerFn()
  .validator(requireString)
  .handler(({ data }) =>
    importRuntime.runPromise(
      asMember({ pages: [data] }, () =>
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
      asMember({ pages: [data] }, () =>
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
      asMember({ pages: [data] }, () =>
        retryPageAudio(data).pipe(Effect.map(serializableAudioReport)),
      ),
    ),
  );

// A draft can only be worked on while its page awaits verification.
const editablePage = (pageId: string) =>
  importRuntime.runPromise(
    asMember({ pages: [pageId] }, (member) =>
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
        return { ...found, member };
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
      }).pipe(billedTo(page.member.userId)),
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
      }).pipe(billedTo(page.member.userId)),
    );
  });
