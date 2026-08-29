// One entry of a learning pass. The target text starts as the input placeholder
// and screen-reader hint; both disappear once the learner types. The accepted
// answers travel with the item, so matching needs no round trip or grading.
export type LearnItem = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly hasAudio: boolean;
  readonly textbookAnswers: ReadonlyArray<string>;
};

export type LearnPass = {
  readonly unit: { readonly id: string; readonly name: string };
  readonly items: ReadonlyArray<LearnItem>;
};
