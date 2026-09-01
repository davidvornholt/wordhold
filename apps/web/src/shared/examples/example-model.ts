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

export const preparedExamplesByEntry = (
  prepared: ReadonlyArray<PreparedEntryExample>,
): ReadonlyMap<string, PreparedExampleSentence | null> =>
  new Map(prepared.map(({ entryId, example }) => [entryId, example]));

export const attachPreparedExamples = <
  T extends {
    readonly entryId: string;
    readonly example: PreparedExampleSentence | null;
  },
>(
  items: ReadonlyArray<T>,
  prepared: ReadonlyArray<PreparedEntryExample>,
): ReadonlyArray<T> => {
  const byEntry = preparedExamplesByEntry(prepared);
  return items.map((item) => ({
    ...item,
    example: byEntry.get(item.entryId) ?? item.example,
  }));
};

export const prepareItemExamples = async <
  T extends {
    readonly entryId: string;
    readonly example: PreparedExampleSentence | null;
  },
>(
  items: ReadonlyArray<T>,
  prepareExamples: PrepareExamples,
) =>
  attachPreparedExamples(
    items,
    await prepareExamples({ data: items.map((item) => item.entryId) }),
  );
