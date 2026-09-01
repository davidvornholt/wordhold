import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';

// One direction of a learning pass. Its answer starts as the input placeholder
// and screen-reader hint; both disappear once the learner types. The accepted
// answers travel with the item, so matching needs no round trip or grading.
export type LearnItem = {
  readonly cardId: string;
  readonly direction: AnswerDirection;
  readonly entryId: string;
  readonly unitId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly hasAudio: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly textbookAnswers: ReadonlyArray<string>;
};

export const learnPrompt = (item: LearnItem): string =>
  item.direction === 'to_target' ? item.nativeText : item.targetText;

export const learnAnswer = (item: LearnItem): string =>
  item.direction === 'to_target' ? item.targetText : item.nativeText;

export type LearnSelectionPass = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly directions: ReadonlyArray<{
    readonly direction: AnswerDirection;
    readonly unintroduced: number;
  }>;
};

export type LearnPass = LearnSelectionPass & {
  readonly unit: { readonly id: string; readonly name: string };
};
