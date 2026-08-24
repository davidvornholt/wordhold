import { Effect } from 'effect';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';

type VerificationOperations<T, Failure> = {
  readonly claimPage: Effect.Effect<boolean, Failure>;
  readonly insertEntries: Effect.Effect<T, Failure>;
};

export const commitVerifiedPage = <T, Failure>(
  operations: VerificationOperations<T, Failure>,
): Effect.Effect<T, Failure | PageAlreadyVerifiedError> =>
  Effect.flatMap(
    operations.claimPage,
    (claimed): Effect.Effect<T, Failure | PageAlreadyVerifiedError> => {
      if (claimed) {
        return operations.insertEntries;
      }
      return Effect.fail(
        new PageAlreadyVerifiedError({
          message: 'Diese Seite wurde bereits importiert.',
        }),
      );
    },
  );
