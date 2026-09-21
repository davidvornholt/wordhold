import type { GrammarInfo } from '@wordhold/ai/extraction/schema';
import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../grading/normalize';
import type { NewExampleData } from './entry-fields';

export type NewVocabularyEntry = {
  readonly courseId: string;
  readonly unitId: string;
  // The photographed page the entry was read from; null for a typed entry.
  readonly pageId: string | null;
  readonly targetText: string;
  readonly nativeText: string;
  readonly grammar: GrammarInfo | null;
  readonly example: NewExampleData | undefined;
};

export type InsertedVocabularyEntry = {
  readonly id: string;
  readonly targetText: string;
};

// Every new entry gets the same companions whichever way it arrived: its
// example sentence, both texts as accepted answers for deterministic
// grading, and one card per direction so it can be learned and scheduled.
// Runs inside the caller's transaction.
export const insertVocabularyEntries = (
  sql: Database,
  entries: ReadonlyArray<NewVocabularyEntry>,
) =>
  Effect.gen(function* () {
    if (entries.length === 0) {
      return [] as ReadonlyArray<InsertedVocabularyEntry>;
    }
    const inserted =
      yield* sql<InsertedVocabularyEntry>`insert into entries ${sql.insert(
        entries.map((entry) => ({
          courseId: entry.courseId,
          unitId: entry.unitId,
          pageId: entry.pageId,
          targetText: entry.targetText,
          nativeText: entry.nativeText,
          grammar: entry.grammar,
        })),
      )} returning id, target_text as "targetText"`;
    const examples = entries.flatMap((entry, index) => {
      const entryId = inserted[index]?.id;
      return entryId === undefined || entry.example === undefined
        ? []
        : [
            {
              entryId,
              targetText: entry.example.targetText,
              nativeText: entry.example.nativeText ?? null,
              source: entry.example.source,
            },
          ];
    });
    if (examples.length > 0) {
      yield* sql`insert into entry_examples ${sql.insert(examples)}`;
    }
    const answers = entries.flatMap((entry, index) => {
      const entryId = inserted[index]?.id;
      return entryId === undefined
        ? []
        : [
            {
              entryId,
              direction: 'to_target',
              text: entry.targetText,
              normalized: normalizeAnswer(entry.targetText),
              source: 'textbook',
            },
            {
              entryId,
              direction: 'to_native',
              text: entry.nativeText,
              normalized: normalizeAnswer(entry.nativeText),
              source: 'textbook',
            },
          ];
    });
    if (answers.length > 0) {
      yield* sql`insert into accepted_answers ${sql.insert(answers)} on conflict do nothing`;
    }
    const cardRows = inserted.flatMap((entry) => [
      { entryId: entry.id, direction: 'to_target' },
      { entryId: entry.id, direction: 'to_native' },
    ]);
    if (cardRows.length > 0) {
      yield* sql`insert into cards ${sql.insert(cardRows)}`;
    }
    return inserted;
  });
