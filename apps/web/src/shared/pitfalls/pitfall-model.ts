import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { AnswerDirection } from '@wordhold/db/schema/directions';

export type PreparedEntryPitfalls = {
  readonly entryId: string;
  readonly pitfalls: ReadonlyArray<SpellingPitfall>;
};

export type PreparePitfalls = (input: {
  readonly data: Array<string>;
}) => Promise<ReadonlyArray<PreparedEntryPitfalls>>;

export const withoutPitfalls: PreparePitfalls = () => Promise.resolve([]);

// Only a word asked in the course's language is spelled by the learner, so
// only its card shows where the word is misspelled.
export const shownPitfalls = (card: {
  readonly direction: AnswerDirection;
  readonly spellingPitfalls: ReadonlyArray<SpellingPitfall> | null;
}): ReadonlyArray<SpellingPitfall> | null =>
  card.direction === 'to_target' ? card.spellingPitfalls : null;
