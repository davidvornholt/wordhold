import type { ExtractionResult } from '@wordhold/ai/extraction';

export class PageNotPendingError extends Error {
  readonly name = 'PageNotPendingError';
}

type ExtractionRetryDependencies<Input, Updated> = {
  readonly loadPending: () => Promise<Input | undefined>;
  readonly extract: (input: Input) => Promise<ExtractionResult>;
  readonly saveIfPending: (
    result: ExtractionResult,
  ) => Promise<Updated | undefined>;
};

export const retryPendingExtraction = async <Input, Updated>(
  dependencies: ExtractionRetryDependencies<Input, Updated>,
): Promise<Updated> => {
  const input = await dependencies.loadPending();
  if (input === undefined) {
    throw new PageNotPendingError(
      'Nur noch nicht importierte Seiten können erneut ausgelesen werden.',
    );
  }
  const result = await dependencies.extract(input);
  const updated = await dependencies.saveIfPending(result);
  if (updated === undefined) {
    throw new PageNotPendingError(
      'Die Seite wurde während des Auslesens bereits importiert.',
    );
  }
  return updated;
};
