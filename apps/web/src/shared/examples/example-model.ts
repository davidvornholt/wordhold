import type { ExampleSource } from '@wordhold/db/schema/entries';

export type ExampleSentence = {
  readonly targetText: string;
  readonly nativeText: string | null;
  readonly source: ExampleSource;
};

export type PreparedExampleSentence = ExampleSentence & {
  readonly hasAudio: boolean;
};

export type PreparedEntryExample = {
  readonly entryId: string;
  readonly example: PreparedExampleSentence | null;
};

export type PrepareExamples = (input: {
  readonly data: Array<string>;
}) => Promise<ReadonlyArray<PreparedEntryExample>>;

export const withoutExamples: PrepareExamples = () => Promise.resolve([]);
