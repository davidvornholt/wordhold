import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ExampleSource } from '@wordhold/db/schema/entries';
import type { CardState } from '@wordhold/db/schema/practice';
import type { VocabularyEntry } from './course-units';

export type VocabularyRow = {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly exampleTargetText: string | null;
  readonly exampleNativeText: string | null;
  readonly exampleSource: ExampleSource | null;
  readonly cardId: string;
  readonly direction: AnswerDirection;
  readonly state: CardState;
  readonly dueAt: Date | null;
  readonly introducedAt: Date | null;
  readonly failures: number;
};

export const groupVocabularyRows = (
  rows: ReadonlyArray<VocabularyRow>,
): ReadonlyArray<VocabularyEntry> => {
  const entries = new Map<string, VocabularyEntry>();
  for (const row of rows) {
    const card = {
      cardId: row.cardId,
      direction: row.direction,
      state: row.state,
      dueAt: row.dueAt,
      introducedAt: row.introducedAt,
      failures: row.failures,
    };
    const entry = entries.get(row.id);
    if (entry === undefined) {
      entries.set(row.id, {
        id: row.id,
        unitId: row.unitId,
        unitName: row.unitName,
        targetText: row.targetText,
        nativeText: row.nativeText,
        example:
          row.exampleTargetText === null || row.exampleSource === null
            ? null
            : {
                targetText: row.exampleTargetText,
                nativeText: row.exampleNativeText,
                source: row.exampleSource,
              },
        introduced: row.introducedAt !== null,
        cards: [card],
      });
    } else {
      entries.set(row.id, {
        ...entry,
        introduced: entry.introduced || row.introducedAt !== null,
        cards: [...entry.cards, card],
      });
    }
  }
  return [...entries.values()];
};
