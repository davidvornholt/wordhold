import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import type { ImportPayloadData } from '../schemas/import-payload';
import {
  type DuplicateVerdict,
  duplicateVerdict,
  type ExistingEntry,
  entryIdentityKey,
} from './entry-identity';
import { selectUnitEntries } from './unit-entries';

type PayloadEntry = ImportPayloadData['entries'][number];

const quoted = (words: ReadonlyArray<string>): string =>
  words.map((word) => `„${word}“`).join(', ');

const isBlockedDuplicate = (
  entry: PayloadEntry,
  verdict: DuplicateVerdict,
): boolean =>
  entry.skipDuplicate === true
    ? verdict !== 'exact'
    : verdict === 'exact' ||
      (verdict === 'exception' && entry.duplicateException !== true);

const inspectEntry = (
  pools: Map<string, Array<ExistingEntry>>,
  entry: PayloadEntry,
  unitId: string | undefined,
): string | undefined => {
  if (unitId === undefined) {
    return undefined;
  }
  const pool = pools.get(unitId) ?? [];
  const verdict = duplicateVerdict(
    { targetText: entry.targetText, example: entry.example ?? '' },
    pool,
  );
  const blocked = isBlockedDuplicate(entry, verdict);
  if (entry.skipDuplicate !== true) {
    pool.push({
      targetText: entry.targetText,
      examples:
        entry.example === undefined || entry.example === ''
          ? []
          : [entry.example],
    });
    pools.set(unitId, pool);
  }
  return blocked ? entry.targetText : undefined;
};

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
    const blocked = payload.entries.flatMap((entry, index) => {
      const blockedWord = inspectEntry(pools, entry, unitIds[index]);
      return blockedWord === undefined ? [] : [blockedWord];
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
