import { Database } from '@wordhold/db/client';
import { Effect, Schema } from 'effect';
import { Uuid } from '../validate/uuid';
import { AuthDatabaseError } from './auth-database-error';

// Records a request names, each of which must belong to a course of the
// person making it.
export type OwnedReferences = {
  readonly courses?: ReadonlyArray<string>;
  readonly books?: ReadonlyArray<string>;
  readonly units?: ReadonlyArray<string>;
  readonly entries?: ReadonlyArray<string>;
  readonly cards?: ReadonlyArray<string>;
  readonly pages?: ReadonlyArray<string>;
  readonly importSessions?: ReadonlyArray<string>;
};

// Someone else's record is reported like a missing one, so its existence
// stays private.
export class NotOwnedError extends Schema.TaggedError<NotOwnedError>()(
  'NotOwnedError',
  { message: Schema.String },
) {}

const isUuid = Schema.is(Uuid);

const ownedCount = (
  sql: Database,
  kind: keyof OwnedReferences,
  ids: string,
  ownerId: string,
) => {
  switch (kind) {
    case 'courses':
      return sql<{ count: number }>`select count(*)::int as count from courses
        where id = any(${ids}::uuid[]) and owner_id = ${ownerId}`;
    case 'books':
      return sql<{ count: number }>`select count(*)::int as count from books b
        join courses c on c.id = b.course_id
        where b.id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    case 'units':
      return sql<{ count: number }>`select count(*)::int as count from units u
        join courses c on c.id = u.course_id
        where u.id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    case 'entries':
      return sql<{ count: number }>`select count(*)::int as count from entries e
        join courses c on c.id = e.course_id
        where e.id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    case 'cards':
      return sql<{ count: number }>`select count(*)::int as count from cards k
        join entries e on e.id = k.entry_id join courses c on c.id = e.course_id
        where k.id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    case 'pages':
      return sql<{ count: number }>`select count(*)::int as count from pages p
        join courses c on c.id = p.course_id
        where p.id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    case 'importSessions':
      // A session exists through its pages, which all share one course.
      return sql<{
        count: number;
      }>`select count(distinct p.import_session_id)::int as count
        from pages p join courses c on c.id = p.course_id
        where p.import_session_id = any(${ids}::uuid[]) and c.owner_id = ${ownerId}`;
    default:
      return kind satisfies never;
  }
};

export const assertOwned = (ownerId: string, references: OwnedReferences) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const notFound = new NotOwnedError({ message: 'Nicht gefunden.' });
    const named = (
      Object.entries(references) as Array<
        [keyof OwnedReferences, ReadonlyArray<string> | undefined]
      >
    )
      .map(([kind, ids]) => [kind, [...new Set(ids ?? [])]] as const)
      .filter(([, unique]) => unique.length > 0);
    for (const [kind, unique] of named) {
      if (!unique.every(isUuid)) {
        return yield* notFound;
      }
      const [row] = yield* ownedCount(
        sql,
        kind,
        `{${unique.join(',')}}`,
        ownerId,
      ).pipe(
        Effect.mapError(
          (cause) =>
            new AuthDatabaseError({
              operation: `check ${kind} ownership`,
              cause,
              message: 'Die Berechtigung konnte nicht geprüft werden.',
            }),
        ),
      );
      if (row?.count !== unique.length) {
        return yield* notFound;
      }
    }
  });

// The entries among `entryIds` that belong to the person, for a batch that
// skips an entry deleted in the meantime instead of failing.
export const ownedEntryIds = (
  ownerId: string,
  entryIds: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const unique = [...new Set(entryIds)].filter(isUuid);
    if (unique.length === 0) {
      return [];
    }
    const sql = yield* Database;
    const rows = yield* sql<{ id: string }>`select e.id from entries e
      join courses c on c.id = e.course_id
      where e.id = any(${`{${unique.join(',')}}`}::uuid[]) and c.owner_id = ${ownerId}`.pipe(
      Effect.mapError(
        (cause) =>
          new AuthDatabaseError({
            operation: 'check entries ownership',
            cause,
            message: 'Die Berechtigung konnte nicht geprüft werden.',
          }),
      ),
    );
    const owned = new Set(rows.map((row) => row.id));
    return unique.filter((id) => owned.has(id));
  });
