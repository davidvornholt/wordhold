import type { PracticeSession } from '../src/features/practice/schemas/practice-models';

type FixtureCard = PracticeSession['items'][number];

export type PreparedExamples = ReadonlyArray<{
  readonly entryId: string;
  readonly example: FixtureCard['example'];
}>;

export type DeferredExamples = {
  readonly promise: Promise<PreparedExamples>;
  readonly resolve: (value: PreparedExamples) => void;
};

export const makeDeferredExamples = (): DeferredExamples => {
  let resolve: DeferredExamples['resolve'] = () => undefined;
  const promise = new Promise<PreparedExamples>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};
