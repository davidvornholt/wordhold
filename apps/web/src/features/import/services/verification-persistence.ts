import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
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
    const inserted =
      entriesToInsert.length === 0
        ? []
        : yield* sql<{
            id: string;
            targetText: string;
          }>`insert into entries ${sql.insert(
            entriesToInsert.map(({ entry, unitId }) => ({
              courseId,
              unitId,
              pageId,
              targetText: entry.targetText,
              nativeText: entry.nativeText,
              grammar: entry.grammar ?? null,
            })),
          )} returning id, target_text as "targetText"`;
    if (inserted.length !== entriesToInsert.length) {
      return yield* new ImportInvariantError({
        message: 'Not every verified entry was inserted.',
      });
    }
    const examples = entriesToInsert.flatMap(({ entry }, index) => {
      const entryId = inserted[index]?.id;
      return entryId === undefined ||
        entry.example === undefined ||
        entry.example === ''
        ? []
        : [
            {
              entryId,
              targetText: entry.example,
              source: 'textbook',
            },
          ];
    });
    if (examples.length > 0) {
      yield* sql`insert into entry_examples ${sql.insert(examples)}`;
    }
    const answers = entriesToInsert.flatMap(({ entry }, index) => {
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
