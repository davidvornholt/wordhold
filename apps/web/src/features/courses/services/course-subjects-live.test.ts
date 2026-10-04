import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedOwner } from '../../../shared/testing/owner-fixture';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';

const languageCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownerId = 'owner';
const otherOwnerId = 'other-owner';

const runServiceTest = <A, E>(
  effect: Effect.Effect<A, E, Database | CourseService>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.all([seedOwner(ownerId), seedOwner(otherOwnerId)]).pipe(
        Effect.zipRight(effect),
        Effect.provide(
          CourseService.Default.pipe(
            Layer.provide(CourseStore.live.pipe(Layer.provide(databaseLayer))),
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedLanguageCourse = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, owner_id, name, target_language)
    values (${languageCourseId}, ${ownerId}, 'Französisch', 'fr')
  `;
});

const failureTag = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
  );

describe('course subjects', () => {
  it('creates a subject with a hidden book and a term-to-definition direction', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject(ownerId, {
          name: 'Chemie',
        });
        const [course] = yield* sql<{
          readonly ownerId: string;
          readonly name: string;
          readonly kind: string;
          readonly directions: ReadonlyArray<string>;
        }>`select owner_id as "ownerId", name, kind, directions::text[] as directions from courses where id = ${courseId}`;
        expect(course).toEqual({
          ownerId,
          name: 'Chemie',
          kind: 'terms',
          directions: ['to_native'],
        });
        const books = yield* sql<{
          readonly name: string;
        }>`select name from books where course_id = ${courseId}`;
        expect(books).toEqual([{ name: 'Allgemein' }]);
      }),
    );
  });

  it('refuses books and units in a subject', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject(ownerId, {
          name: 'Chemie',
        });
        const [book] = yield* sql<{
          readonly id: string;
        }>`select id from books where course_id = ${courseId}`;
        const bookId = book?.id ?? '';
        const refused = yield* Effect.all([
          failureTag(service.createBook({ courseId, name: 'Skript' })),
          failureTag(service.renameBook({ courseId, bookId, name: 'Skript' })),
          failureTag(service.createUnit({ courseId, bookId, name: 'Kinetik' })),
          failureTag(
            service.reorderUnits({
              courseId,
              bookId,
              expectedUnitIds: [],
              unitIds: [],
            }),
          ),
        ]);
        expect(new Set(refused)).toEqual(new Set(['CourseKindMismatchError']));
        const units =
          yield* sql`select id from units where course_id = ${courseId}`;
        expect(units).toEqual([]);
      }),
    );
  });
});

describe('course subject names', () => {
  it('refuses a name another course of the same person has, in any casing', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const service = yield* CourseService;
        yield* service.createSubject(ownerId, { name: 'Chemie' });
        expect(
          yield* failureTag(service.createSubject(ownerId, { name: 'chemie' })),
        ).toBe('SubjectConflictError');
        expect(
          yield* failureTag(
            service.createSubject(ownerId, { name: 'Französisch' }),
          ),
        ).toBe('SubjectConflictError');
      }),
    );
  });

  it('checks names only among the courses of the same person', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const service = yield* CourseService;
        yield* service.createSubject(ownerId, { name: 'Chemie' });
        const { courseId } = yield* service.createSubject(otherOwnerId, {
          name: 'Chemie',
        });
        expect(
          yield* failureTag(
            service.createSubject(otherOwnerId, { name: 'chemie' }),
          ),
        ).toBe('SubjectConflictError');
        expect(
          yield* service.renameSubject({ courseId, name: 'Französisch' }),
        ).toEqual({ name: 'Französisch' });
      }),
    );
  });

  it('renames a subject but never a language course', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const sql = yield* Database;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject(ownerId, {
          name: 'Chemie',
        });
        yield* service.createSubject(ownerId, { name: 'Biologie' });
        expect(
          yield* service.renameSubject({ courseId, name: 'Organische Chemie' }),
        ).toEqual({ name: 'Organische Chemie' });
        // Its own name in another casing is not a conflict.
        expect(
          yield* service.renameSubject({ courseId, name: 'organische Chemie' }),
        ).toEqual({ name: 'organische Chemie' });
        expect(
          yield* failureTag(
            service.renameSubject({ courseId, name: 'Biologie' }),
          ),
        ).toBe('SubjectConflictError');
        expect(
          yield* failureTag(
            service.renameSubject({
              courseId: languageCourseId,
              name: 'Latein',
            }),
          ),
        ).toBe('CourseSettingsNotFoundError');
        const [language] = yield* sql<{
          readonly name: string;
        }>`select name from courses where id = ${languageCourseId}`;
        expect(language?.name).toBe('Französisch');
      }),
    );
  });

  it('keeps the one direction of a subject', async () => {
    await runServiceTest(
      Effect.gen(function* () {
        yield* seedLanguageCourse;
        const service = yield* CourseService;
        const { courseId } = yield* service.createSubject(ownerId, {
          name: 'Chemie',
        });
        expect(
          yield* failureTag(
            service.setDirections({ courseId, directions: ['to_target'] }),
          ),
        ).toBe('CourseKindMismatchError');
        expect(
          yield* failureTag(
            service.setDirections({
              courseId: missingCourseId,
              directions: ['to_target'],
            }),
          ),
        ).toBe('CourseSettingsNotFoundError');
        expect(
          yield* service.setDirections({
            courseId: languageCourseId,
            directions: ['to_target'],
          }),
        ).toEqual(['to_target']);
      }),
    );
  });
});
