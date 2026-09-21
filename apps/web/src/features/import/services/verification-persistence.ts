import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { ImportInvariantError } from '../errors/import-invariant-error';
import type { ImportPayloadData } from '../schemas/import-payload';

type ResolvedEntry = {
  readonly entry: ImportPayloadData['entries'][number];
  readonly unitId: string;
};

export const persistVerifiedEntries = (
  sql: Database,
  courseId: string,
  pageId: string,
  entriesToInsert: ReadonlyArray<ResolvedEntry>,
) =>
  Effect.gen(function* () {
    const inserted = yield* insertVocabularyEntries(
      sql,
      entriesToInsert.map(({ entry, unitId }) => ({
        courseId,
        unitId,
        pageId,
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        grammar: entry.grammar ?? null,
        example: entry.example,
      })),
    );
    if (inserted.length !== entriesToInsert.length) {
      return yield* new ImportInvariantError({
        message: 'Not every verified entry was inserted.',
      });
    }
    return inserted;
  });
