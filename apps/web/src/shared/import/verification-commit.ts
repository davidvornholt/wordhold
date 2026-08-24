export class PageAlreadyVerifiedError extends Error {
  readonly name = 'PageAlreadyVerifiedError';
}

type VerificationOperations<T> = {
  readonly claimPage: () => Promise<boolean>;
  readonly insertEntries: () => Promise<T>;
};

export type RunVerificationTransaction<T> = (
  work: (operations: VerificationOperations<T>) => Promise<T>,
) => Promise<T>;

export const commitVerifiedPage = async <T>(
  runTransaction: RunVerificationTransaction<T>,
): Promise<T> =>
  runTransaction(async (operations) => {
    if (!(await operations.claimPage())) {
      throw new PageAlreadyVerifiedError(
        'Diese Seite wurde bereits importiert.',
      );
    }
    return operations.insertEntries();
  });
