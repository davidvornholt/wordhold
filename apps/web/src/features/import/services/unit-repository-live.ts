import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import type { Unit } from './repository';

export const unitRepositoryLive = (sql: Database) => ({
  // The verify screen offers these for selection, so the entry count matters:
  // it is how you recognise the unit you started yesterday.
  listUnits: (courseId: string) =>
    sql<Unit>`
      select units.id,
        units.name,
        units.position,
        count(entries.id)::integer as "entryCount"
      from units
      left join entries on entries.unit_id = units.id
      where units.course_id = ${courseId}
      group by units.id
      order by units.position, units.name
    `.pipe(
      Effect.mapError(
        (cause) =>
          new ImportDatabaseError({
            operation: 'list units',
            cause,
            message: 'Database operation failed: list units.',
          }),
      ),
    ),
});
