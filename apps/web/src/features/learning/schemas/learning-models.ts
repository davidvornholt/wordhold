// A unit as the learning screen offers it: recognisable by name, and worth
// opening only while it still holds words the learner has never met.
export type LearnableUnit = {
  readonly id: string;
  readonly name: string;
  readonly words: number;
  readonly unlearned: number;
};

// One word of a learning pass. The target text is on screen while the learner
// types it, so the answers travel with the item and the match happens without
// a round trip; nothing here is graded and nothing is hidden.
export type LearnItem = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly hasAudio: boolean;
  readonly acceptedNormalized: ReadonlyArray<string>;
};

export type LearnPass = {
  readonly unit: { readonly id: string; readonly name: string };
  readonly items: ReadonlyArray<LearnItem>;
};
