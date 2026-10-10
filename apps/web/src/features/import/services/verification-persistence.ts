import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import { ImportInvariantError } from '../errors/import-invariant-error';
import type { ImportPayloadData } from '../schemas/import-payload';

type ResolvedEntry = {
  readonly entry: ImportPayloadData['entries'][number];
  // Null for a word filed directly into the book.
  readonly unitId: string | null;
};

// The course, book and page every verified word of the page shares.
type VerifiedPage = {
  readonly courseId: string;
  readonly bookId: string;
  readonly pageId: string;
};

export const persistVerifiedEntries = (
  sql: Database,
  { courseId, bookId, pageId }: VerifiedPage,
  entriesToInsert: ReadonlyArray<ResolvedEntry>,
) =>
  Effect.gen(function* () {
    const inserted = yield* insertVocabularyEntries(
      sql,
      entriesToInsert.map(({ entry, unitId }) => ({
        courseId,
        bookId,
        unitId,
        pageId,
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        grammar: entry.grammar ?? null,
        example: entry.example,
        synonyms: entry.synonyms ?? null,
        antonyms: entry.antonyms ?? null,
      })),
    );
    if (inserted.length !== entriesToInsert.length) {
      return yield* new ImportInvariantError({
        message: 'Not every verified entry was inserted.',
      });
    }
    return inserted;
  });
