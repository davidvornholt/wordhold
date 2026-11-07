import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { settledColumns } from '../../../shared/ai/usage-ledger';
import {
  accessCodeLifetimeHours,
  codeDigest,
  newAccessCode,
} from '../../../shared/auth/code-secrets';
import type { SamplePerson } from '../content/sample-models';
import { samplePeople } from '../content/sample-people';
import { SampleDataError } from '../errors/sample-data-errors';
import { writeSampleCourse } from './sample-course-writer';

export type SeedOutcome =
  | { readonly kind: 'skipped' }
  | {
      readonly kind: 'seeded';
      readonly people: number;
      readonly courses: number;
      readonly entries: number;
      readonly answers: number;
    };

// The GitHub account previews allow, as GITHUB_ALLOWED_USER_ID names it there.
// The seed runs with nothing but the database URL, so it is written out here;
// signing in with it finds the sample administrator.
export const administratorGithubId = '157214705';

const hour = 3_600_000;
const day = 24 * hour;

// Better Auth's own tables are written by hand in an empty database, never
// beside app data. Sign-in state left by an abandoned GitHub login is not app
// data.
const holdsAppData = Effect.gen(function* () {
  const sql = yield* Database;
  const tables = yield* sql<{ readonly name: string }>`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name <> 'verification'
  `;
  for (const table of tables) {
    const [row] = yield* sql<{ readonly present: boolean }>`
      select exists (select 1 from ${sql(table.name)}) as present
    `;
    if (row?.present === true) {
      return true;
    }
  }
  return false;
});

const writeSignIn = (person: SamplePerson, userId: string, joinedAt: Date) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    switch (person.standing) {
      case 'administrator':
        // The account row is what GitHub sign-in looks up.
        yield* sql`insert into account
            (id, account_id, provider_id, user_id, created_at, updated_at)
          values (${crypto.randomUUID()}, ${administratorGithubId}, 'github',
            ${userId}, ${joinedAt}, ${joinedAt})`;
        return;
      case 'invited': {
        // The invitation is still open. Nobody knows its code, so the
        // administrator issues a new one to try it.
        const digest = yield* Effect.promise(() => codeDigest(newAccessCode()));
        yield* sql`insert into access_codes
            (digest, user_id, kind, expires_at, created_at)
          values (${digest}, ${userId}, 'invitation',
            ${new Date(joinedAt.getTime() + accessCodeLifetimeHours * hour)},
            ${joinedAt})`;
        return;
      }
      default:
        // A passkey that matches no device: it makes the member registered.
        yield* sql`insert into passkey (id, name, public_key, user_id,
            credential_id, counter, device_type, backed_up, created_at)
          values (${crypto.randomUUID()}, 'Telefon', 'sample', ${userId},
            ${crypto.randomUUID()}, 0, 'multiDevice', true, ${joinedAt})`;
    }
  });

const writePerson = (person: SamplePerson, now: Date) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const userId = crypto.randomUUID();
    const joinedAt = new Date(now.getTime() - person.joinedDaysAgo * day);
    const lastActiveAt =
      person.lastActiveHoursAgo === null
        ? null
        : new Date(now.getTime() - person.lastActiveHoursAgo * hour);
    yield* sql`insert into "user" (id, name, email, created_at, updated_at)
      values (${userId}, ${person.name}, ${person.email}, ${joinedAt},
        ${joinedAt})`;
    yield* sql`insert into members
        (user_id, name, admin, enabled, last_active_at, created_at)
      values (${userId}, ${person.name}, ${person.standing === 'administrator'},
        ${person.standing !== 'suspended'}, ${lastActiveAt}, ${joinedAt})`;
    yield* writeSignIn(person, userId, joinedAt);
    let entries = 0;
    let answers = 0;
    for (const [index, course] of person.courses.entries()) {
      const written = yield* writeSampleCourse(sql, {
        ownerId: userId,
        course,
        createdAt: new Date(joinedAt.getTime() + index * hour),
        now,
      });
      entries += written.entries;
      answers += written.answers;
    }
    if (person.usage.length > 0) {
      yield* sql`insert into ai_usage ${sql.insert(
        person.usage.map((request) => ({
          userId,
          operation: request.call.operation,
          provider: request.call.provider,
          model: request.call.model,
          status: request.usage === undefined ? 'failed' : 'succeeded',
          ...settledColumns(request.call, request.usage),
          createdAt: new Date(now.getTime() - request.daysAgo * day),
        })),
      )}`;
    }
    return { courses: person.courses.length, entries, answers };
  });

// Fills an empty database with made-up people, courses and practice history,
// all dated relative to `now`. A database that already holds app data is left
// as it is. The lock keeps two runs from both finding the database empty.
export const seedSampleData = (now: Date) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`select pg_advisory_xact_lock(hashtextextended('wordhold:sample-data', 0))`;
        if (yield* holdsAppData) {
          return { kind: 'skipped' } satisfies SeedOutcome;
        }
        let courses = 0;
        let entries = 0;
        let answers = 0;
        for (const person of samplePeople) {
          const written = yield* writePerson(person, now);
          courses += written.courses;
          entries += written.entries;
          answers += written.answers;
        }
        return {
          kind: 'seeded',
          people: samplePeople.length,
          courses,
          entries,
          answers,
        } satisfies SeedOutcome;
      }),
    );
  }).pipe(
    Effect.catchTag('SqlError', (cause) =>
      Effect.fail(
        new SampleDataError({
          cause,
          message: 'Could not write the sample data.',
        }),
      ),
    ),
  );
