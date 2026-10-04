import { Database } from '@wordhold/db/client';
import type { AccessCodeKind } from '@wordhold/db/schema/members';
import { Context, Effect, Layer } from 'effect';
import {
  accessCodeLifetimeHours,
  codeDigest,
  newAccessCode,
} from '../../../shared/auth/code-secrets';
import {
  PeopleDatabaseError,
  PersonNotFoundError,
  PersonSuspendedError,
} from '../errors/people-errors';
import type {
  IssuedCode,
  Person,
  UsagePeriod,
  UsageRow,
} from '../schemas/people-models';
import { placeholderEmail } from './placeholder-email';

type PersonRow = Omit<Person, 'code'> & {
  readonly codeKind: AccessCodeKind | null;
  readonly codeExpiresAt: Date | null;
};

const notFound = () =>
  new PersonNotFoundError({
    message:
      'Diese Person gibt es nicht mehr oder ihr Zugang lässt sich hier nicht ändern. Lade die Seite neu.',
  });

const toPerson = ({
  codeKind,
  codeExpiresAt,
  ...person
}: PersonRow): Person => ({
  ...person,
  code:
    codeKind === null || codeExpiresAt === null
      ? null
      : { kind: codeKind, expiresAt: codeExpiresAt },
});

export type PeopleStoreShape = {
  readonly list: Effect.Effect<ReadonlyArray<Person>, PeopleDatabaseError>;
  readonly get: (
    userId: string,
  ) => Effect.Effect<Person, PeopleDatabaseError | PersonNotFoundError>;
  // Creates the account and the invitation that lets the person save their
  // first passkey.
  readonly invite: (
    name: string,
  ) => Effect.Effect<IssuedCode, PeopleDatabaseError>;
  // A new invitation for someone who never registered, otherwise a recovery
  // code that replaces their passkeys. Replaces any earlier code.
  readonly issueCode: (
    userId: string,
  ) => Effect.Effect<
    IssuedCode,
    PeopleDatabaseError | PersonNotFoundError | PersonSuspendedError
  >;
  readonly withdrawCode: (
    userId: string,
  ) => Effect.Effect<void, PeopleDatabaseError>;
  // Suspending signs the person out everywhere and withdraws their code.
  readonly setEnabled: (
    userId: string,
    enabled: boolean,
  ) => Effect.Effect<void, PeopleDatabaseError | PersonNotFoundError>;
  // Deletes the account with every course and returns the stored files that
  // belonged to it, for removal once the deletion committed.
  readonly remove: (
    userId: string,
  ) => Effect.Effect<
    ReadonlyArray<string>,
    PeopleDatabaseError | PersonNotFoundError
  >;
  readonly usage: (
    days: UsagePeriod,
  ) => Effect.Effect<ReadonlyArray<UsageRow>, PeopleDatabaseError>;
};

const failure = (operation: string, message: string) => (cause: unknown) =>
  new PeopleDatabaseError({ operation, cause, message });

const changeFailed = (operation: string) =>
  failure(
    operation,
    'Die Änderung wurde nicht gespeichert. Versuche es noch einmal.',
  );

// Takes the lock that sign-ins and passkey registrations hold (see
// shared/auth/access-transaction.ts), so a change cannot race a redemption
// of the person's code.
const withAccessLock = <A, E, R>(sql: Database, work: Effect.Effect<A, E, R>) =>
  sql.withTransaction(
    sql`select pg_advisory_xact_lock(hashtextextended('wordhold:access', 0))`.pipe(
      Effect.zipRight(work),
    ),
  );

const selectPeople = (sql: Database, userId?: string) =>
  sql<PersonRow>`
    select m.user_id as "userId", m.name, m.admin, m.enabled,
      (m.admin or exists (
        select 1 from passkey p where p.user_id = m.user_id
      )) as registered,
      c.kind as "codeKind", c.expires_at as "codeExpiresAt",
      m.last_active_at as "lastActiveAt"
    from members m
    left join access_codes c
      on c.user_id = m.user_id and c.expires_at > now()
    ${userId === undefined ? sql`` : sql`where m.user_id = ${userId}`}
    order by m.admin desc, m.created_at, m.user_id
  `.pipe(Effect.map((rows) => rows.map(toPerson)));

const storeCode = (
  sql: Database,
  { userId, name, kind }: Pick<IssuedCode, 'userId' | 'name' | 'kind'>,
) =>
  Effect.gen(function* () {
    const code = newAccessCode();
    const digest = yield* Effect.promise(() => codeDigest(code));
    const [stored] = yield* sql<{ readonly expiresAt: Date }>`
      insert into access_codes (digest, user_id, kind, expires_at)
      values (${digest}, ${userId}, ${kind}::access_code_kind,
        now() + make_interval(hours => ${accessCodeLifetimeHours}::int))
      on conflict (user_id) do update set digest = excluded.digest,
        kind = excluded.kind, expires_at = excluded.expires_at,
        created_at = now()
      returning expires_at as "expiresAt"
    `;
    if (stored === undefined) {
      return yield* Effect.die(new Error('The access code was not stored.'));
    }
    return {
      userId,
      name,
      kind,
      code,
      expiresAt: stored.expiresAt,
    } satisfies IssuedCode;
  });

const invite = (sql: Database, name: string) =>
  Effect.gen(function* () {
    const userId = crypto.randomUUID();
    yield* sql`insert into "user" (id, name, email)
      values (${userId}, ${name}, ${placeholderEmail(name, userId)})`;
    yield* sql`insert into members (user_id, name) values (${userId}, ${name})`;
    return yield* storeCode(sql, { userId, name, kind: 'invitation' });
  });

const issueCode = (sql: Database, userId: string) =>
  Effect.gen(function* () {
    const [person] = yield* sql<{
      readonly name: string;
      readonly enabled: boolean;
      readonly registered: boolean;
    }>`
      select m.name, m.enabled, exists (
        select 1 from passkey p where p.user_id = m.user_id
      ) as registered
      from members m where m.user_id = ${userId} and not m.admin
    `;
    if (person === undefined) {
      return yield* notFound();
    }
    if (!person.enabled) {
      return yield* new PersonSuspendedError({
        message:
          'Ein gesperrtes Konto bekommt keinen Code. Gib den Zugang zuerst wieder frei.',
      });
    }
    return yield* storeCode(sql, {
      userId,
      name: person.name,
      kind: person.registered ? 'recovery' : 'invitation',
    });
  });

const setEnabled = (sql: Database, userId: string, enabled: boolean) =>
  Effect.gen(function* () {
    const changed = yield* sql`update members set enabled = ${enabled}
      where user_id = ${userId} and not admin returning user_id`;
    if (changed.length === 0) {
      return yield* notFound();
    }
    if (!enabled) {
      yield* sql`delete from session where user_id = ${userId}`;
      yield* sql`delete from access_codes where user_id = ${userId}`;
    }
  });

const remove = (sql: Database, userId: string) =>
  Effect.gen(function* () {
    const found = yield* sql`select 1 from members
      where user_id = ${userId} and not admin`;
    if (found.length === 0) {
      return yield* notFound();
    }
    const files = yield* sql<{ readonly path: string }>`
      select p.image_path as path from pages p
      join courses c on c.id = p.course_id
      where c.owner_id = ${userId}
      union
      select a.path from entry_audio a
      join entries e on e.id = a.entry_id
      join courses c on c.id = e.course_id
      where c.owner_id = ${userId}
      union
      select x.audio_path from entry_examples x
      join entries e on e.id = x.entry_id
      join courses c on c.id = e.course_id
      where c.owner_id = ${userId} and x.audio_path is not null
    `;
    // Entries point at their book and unit with RESTRICT, which the cascade
    // from a course cannot order, so they go first. Deleting the user
    // cascades to courses, member, sessions, passkeys and code; the person's
    // AI usage stays in the totals without them.
    yield* sql`delete from entries e using courses c
      where e.course_id = c.id and c.owner_id = ${userId}`;
    yield* sql`delete from "user" where id = ${userId}`;
    return files.map((file) => file.path);
  });

const usage = (sql: Database, days: UsagePeriod) =>
  sql<UsageRow>`
    select u.user_id as "userId", m.name, u.operation,
      u.provider::text as provider, u.model,
      count(*)::int as requests,
      count(*) filter (where u.status <> 'succeeded')::int as failed,
      count(*) filter (where u.estimated_usd is null)::int as "unknownCost",
      coalesce(sum(u.estimated_usd), 0)::float8 as "estimatedUsd"
    from ai_usage u
    left join members m on m.user_id = u.user_id
    where u.created_at >= now() - make_interval(days => ${days}::int)
    group by u.user_id, m.name, u.operation, u.provider, u.model
    order by m.name nulls last, u.user_id, u.operation, u.model
  `;

export class PeopleStore extends Context.Tag(
  '@wordhold/web/people/PeopleStore',
)<PeopleStore, PeopleStoreShape>() {
  static readonly live = Layer.effect(
    PeopleStore,
    Effect.map(Database, (sql) =>
      PeopleStore.of({
        list: selectPeople(sql).pipe(
          Effect.mapError(
            failure(
              'list people',
              'Die Personen konnten nicht geladen werden.',
            ),
          ),
        ),
        get: (userId) =>
          selectPeople(sql, userId).pipe(
            Effect.mapError(
              failure('get person', 'Die Person konnte nicht geladen werden.'),
            ),
            Effect.flatMap(([person]) =>
              person === undefined
                ? Effect.fail(notFound())
                : Effect.succeed(person),
            ),
          ),
        invite: (name) =>
          withAccessLock(sql, invite(sql, name)).pipe(
            Effect.mapError(changeFailed('invite person')),
          ),
        issueCode: (userId) =>
          withAccessLock(sql, issueCode(sql, userId)).pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(changeFailed('issue access code')(cause)),
            ),
          ),
        withdrawCode: (userId) =>
          withAccessLock(
            sql,
            sql`delete from access_codes where user_id = ${userId}`,
          ).pipe(Effect.asVoid, Effect.mapError(changeFailed('withdraw code'))),
        setEnabled: (userId, enabled) =>
          withAccessLock(sql, setEnabled(sql, userId, enabled)).pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(changeFailed('change access')(cause)),
            ),
          ),
        remove: (userId) =>
          withAccessLock(sql, remove(sql, userId)).pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(changeFailed('delete person')(cause)),
            ),
          ),
        usage: (days) =>
          usage(sql, days).pipe(
            Effect.mapError(
              failure(
                'summarize usage',
                'Die Kosten konnten nicht geladen werden.',
              ),
            ),
          ),
      }),
    ),
  );
}
