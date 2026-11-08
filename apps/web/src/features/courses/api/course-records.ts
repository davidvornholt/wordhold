import { Database } from '@wordhold/db/client';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { NotOwnedError } from '../../../shared/auth/ownership';
import { CourseDatabaseError } from '../errors/courses-errors';

/** A course as the CLI's API names it on every entry. */
export type ApiCourse = {
  readonly id: string;
  readonly name: string;
  readonly kind: CourseKind;
  readonly targetLanguage: LanguageCode;
};

// Someone else's record is reported like a missing one, as everywhere else.
const notFound = new NotOwnedError({ message: 'Nicht gefunden.' });

const databaseError = (operation: string) => (cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Kurse konnten nicht geladen werden.',
  });

/** The person's courses, in the overview's order. */
export const ownedCourses = (ownerId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* sql<ApiCourse>`
      select id, name, kind, target_language as "targetLanguage"
      from courses where owner_id = ${ownerId}
      order by name, id
    `.pipe(Effect.mapError(databaseError('list owned courses')));
  });

export const ownedCourse = (ownerId: string, courseId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [course] = yield* sql<ApiCourse>`
      select id, name, kind, target_language as "targetLanguage"
      from courses where id = ${courseId} and owner_id = ${ownerId}
    `.pipe(Effect.mapError(databaseError('read owned course')));
    return course ?? (yield* notFound);
  });

/** The person's course an entry belongs to. */
export const entryCourse = (ownerId: string, entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const [course] = yield* sql<ApiCourse>`
      select c.id, c.name, c.kind, c.target_language as "targetLanguage"
      from entries e join courses c on c.id = e.course_id
      where e.id = ${entryId} and c.owner_id = ${ownerId}
    `.pipe(Effect.mapError(databaseError('read entry course')));
    return course ?? (yield* notFound);
  });
