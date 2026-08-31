import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import {
  duplicateVerdict,
  type ExistingEntry,
  entryIdentityKey,
} from './entry-identity';
import { selectUnitEntries } from './unit-entries';

const quoted = (words: ReadonlyArray<string>): string =>
  words.map((word) => `„${word}“`).join(', ');

// Runs inside the verify transaction, after the per-course advisory lock, so
// it sees every entry a concurrent import committed. Entries earlier in the
// same payload join the pool, catching a page that lists one word twice.
export const ensureNoDuplicateEntries = (
  sql: Database,
  courseId: string,
  payload: ImportPayloadData,
  unitIds: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const stored = yield* selectUnitEntries(sql, courseId);
    const pools = new Map<string, Array<ExistingEntry>>();
    for (const entry of stored) {
      const pool = pools.get(entry.unitId) ?? [];
      pool.push({ targetText: entry.targetText, examples: entry.examples });
      pools.set(entry.unitId, pool);
    }
    const blocked: Array<string> = [];
    payload.entries.forEach((entry, index) => {
      const unitId = unitIds[index];
      if (unitId === undefined) {
        return;
      }
      const pool = pools.get(unitId) ?? [];
      const verdict = duplicateVerdict(
        { targetText: entry.targetText, example: entry.example ?? '' },
        pool,
      );
      if (
        verdict === 'exact' ||
        (verdict === 'exception' && entry.duplicateException !== true)
      ) {
        blocked.push(entry.targetText);
      }
      pool.push({
        targetText: entry.targetText,
        examples:
          entry.example === undefined || entry.example === ''
            ? []
            : [entry.example],
      });
      pools.set(unitId, pool);
    });
    if (blocked.length > 0) {
      const unique = [
        ...new Map(blocked.map((word) => [entryIdentityKey(word), word])),
      ].map(([, word]) => word);
      return yield* new DuplicateEntryError({
        duplicates: unique,
        message: `Schon in der Einheit gespeichert: ${quoted(unique)}. Lade die Seite neu, um die markierten Einträge zu prüfen.`,
      });
    }
  });
