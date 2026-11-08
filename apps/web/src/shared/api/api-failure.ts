import {
  type Failure,
  NotFound,
  Rejected,
  ServerError,
} from '@wordhold/api/errors';
import {
  Cause,
  Effect,
  Exit,
  type ManagedRuntime,
  Option,
  Schema,
} from 'effect';

// The app's own failures whose messages are written for the learner. Every
// other failure, such as a database error, stays in the server's log.
const notFoundTags = new Set([
  'NotOwnedError',
  'CourseNotFoundError',
  'CourseSettingsNotFoundError',
  'CourseBookNotFoundError',
  'CourseUnitNotFoundError',
  'VocabularyEntryNotFoundError',
]);
const rejectedTags = new Set([
  'VocabularyEntryConflictError',
  'CourseKindMismatchError',
  'CourseUnitConflictError',
]);

const taggedMessage = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  '_tag' in error &&
  typeof error._tag === 'string' &&
  'message' in error &&
  typeof error.message === 'string'
    ? { tag: error._tag, message: error.message }
    : undefined;

/** The failure a client may see for a failed piece of feature work. */
export const apiFailure = (
  cause: Cause.Cause<unknown>,
): Failure | undefined => {
  const error = Option.getOrUndefined(Cause.findErrorOption(cause));
  if (error instanceof NotFound || error instanceof Rejected) {
    return error;
  }
  if (Schema.isSchemaError(error)) {
    return new Rejected({ message: error.message });
  }
  const tagged = taggedMessage(error);
  if (tagged !== undefined && notFoundTags.has(tagged.tag)) {
    return new NotFound({ message: tagged.message });
  }
  if (tagged !== undefined && rejectedTags.has(tagged.tag)) {
    return new Rejected({ message: tagged.message });
  }
  return undefined;
};

const serverError = new ServerError({
  message: 'The request could not be completed.',
});

/**
 * Runs feature work in the feature's own runtime, as the web app's server
 * functions do, and turns its failure into one a client may see.
 */
export const runIn = <A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, unknown>,
  work: Effect.Effect<A, E, R>,
): Effect.Effect<A, Failure> =>
  Effect.flatMap(
    Effect.promise(() => runtime.runPromiseExit(work)),
    (exit) => {
      if (Exit.isSuccess(exit)) {
        return Effect.succeed(exit.value);
      }
      const failure = apiFailure(exit.cause);
      return failure === undefined
        ? Effect.andThen(
            Effect.logError('CLI API request failed', Cause.pretty(exit.cause)),
            Effect.fail(serverError),
          )
        : Effect.fail(failure);
    },
  );
