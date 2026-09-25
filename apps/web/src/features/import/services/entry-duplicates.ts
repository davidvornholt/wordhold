import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import {
  type DuplicateVerdict,
  type ExistingEntry,
  entryIdentityKey,
  findDuplicate,
} from '../../../shared/vocabulary/entry-identity';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import type { ImportPayloadData } from '../schemas/import-payload';
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
  pool: Array<ExistingEntry>,
  entry: PayloadEntry,
): string | undefined => {
  const { verdict } = findDuplicate(
    {
      targetText: entry.targetText,
      example: entry.example?.targetText ?? '',
    },
    pool,
  );
  const blocked = isBlockedDuplicate(entry, verdict);
  if (entry.skipDuplicate !== true) {
    pool.push({
      targetText: entry.targetText,
      examples:
        entry.example === undefined || entry.example.targetText === ''
          ? []
          : [entry.example.targetText],
    });
  }
  return blocked ? entry.targetText : undefined;
};

// Runs inside the verify transaction, after the per-course advisory lock, so
// it sees every entry a concurrent import committed. The pool spans the whole
// course, every book included, and entries earlier in the same payload join
// it, catching a page that lists one word twice.
export const ensureNoDuplicateEntries = (
  sql: Database,
  courseId: string,
  payload: ImportPayloadData,
) =>
  Effect.gen(function* () {
    const stored = yield* selectUnitEntries(sql, courseId);
    const pool: Array<ExistingEntry> = stored.map((entry) => ({
      targetText: entry.targetText,
      examples: entry.examples,
    }));
    const blocked = payload.entries.flatMap((entry) => {
      const blockedWord = inspectEntry(pool, entry);
      return blockedWord === undefined ? [] : [blockedWord];
    });
    if (blocked.length > 0) {
      const unique = [
        ...new Map(blocked.map((word) => [entryIdentityKey(word), word])),
      ].map(([, word]) => word);
      return yield* new DuplicateEntryError({
        duplicates: unique,
        message: `Schon im Kurs gespeichert: ${quoted(unique)}. Lade die Seite neu, um die markierten Einträge zu prüfen.`,
      });
    }
  });
