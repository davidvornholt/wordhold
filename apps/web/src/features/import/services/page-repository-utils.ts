import type { Database } from '@wordhold/db/client';
import { ImportDatabaseError } from '../errors/import-database-error';

export const failure = (operation: string, cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

export const sessionLock = (sql: Database, sessionId: string) =>
  sql`select pg_advisory_xact_lock(hashtextextended(${`wordhold:import-session:${sessionId}`}, 0))`;
