// The example sentence of an entry while it is still being written or
// reviewed: the verify screen edits one per extracted row, the unit screen
// one per hand-typed word. Both hand the same shape to the shared editor.
export type ExampleDraft = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
  // German translation of the example; '' while none exists yet.
  readonly exampleNativeText: string;
  // Set once "Beispielsatz erzeugen" wrote the sentence, so the stored
  // example records the source and the review says the sentence is AI text.
  readonly exampleGenerated?: true;
};

// The draft state a generation request was made from. A response only
// lands when the draft still matches, so a learner who kept typing does
// not have their words replaced by a stale sentence.
export type ExampleGenerationSource = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
};

export type GeneratedExample = {
  readonly target: string;
  readonly native: string;
};

export const exampleGenerationSource = (
  draft: ExampleDraft,
): ExampleGenerationSource => ({
  targetText: draft.targetText.trim(),
  nativeText: draft.nativeText.trim(),
  example: draft.example,
});

export const matchesGenerationSource = (
  draft: ExampleDraft,
  source: ExampleGenerationSource,
): boolean =>
  draft.targetText.trim() === source.targetText &&
  draft.nativeText.trim() === source.nativeText &&
  draft.example === source.example;

export const awaitsTranslationFor = (
  draft: ExampleDraft,
  sentence: string,
): boolean =>
  draft.example.trim() === sentence && draft.exampleNativeText === '';
