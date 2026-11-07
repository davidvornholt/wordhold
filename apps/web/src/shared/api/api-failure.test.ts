import { describe, expect, it } from 'bun:test';
import { NotFound, Rejected } from '@wordhold/api/errors';
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Logger,
  ManagedRuntime,
  Schema,
} from 'effect';
import {
  CourseDatabaseError,
  VocabularyEntryConflictError,
} from '../../features/courses/errors/courses-errors';
import { NotOwnedError } from '../auth/ownership';
import { apiFailure, runIn } from './api-failure';

describe('apiFailure', () => {
  it('reports another person’s record as not found', () => {
    expect(
      apiFailure(Cause.fail(new NotOwnedError({ message: 'Nicht gefunden.' }))),
    ).toEqual(new NotFound({ message: 'Nicht gefunden.' }));
  });

  it('passes on a rule the request breaks with its message', () => {
    const conflict = new VocabularyEntryConflictError({
      targetText: 'el café',
      message: 'Dieses Wort gibt es in diesem Kurs schon.',
    });

    expect(apiFailure(Cause.fail(conflict))).toEqual(
      new Rejected({ message: 'Dieses Wort gibt es in diesem Kurs schon.' }),
    );
  });

  it('rejects input the app’s own schema refuses', () => {
    const decoded = Schema.decodeUnknownExit(Schema.NonEmptyString)('');
    if (Exit.isSuccess(decoded)) {
      throw new Error('An empty string should not decode');
    }

    expect(apiFailure(decoded.cause)).toBeInstanceOf(Rejected);
  });

  it('keeps database errors and defects to the server', () => {
    const databaseError = new CourseDatabaseError({
      operation: 'list vocabulary',
      cause: new Error('connection refused at 10.0.0.5'),
      message: 'Database error',
    });

    expect(apiFailure(Cause.fail(databaseError))).toBeUndefined();
    expect(apiFailure(Cause.die(new Error('boom')))).toBeUndefined();
  });
});

describe('runIn', () => {
  const runtime = ManagedRuntime.make(Layer.empty);

  it('gives back the work’s value', async () => {
    expect(await Effect.runPromise(runIn(runtime, Effect.succeed(3)))).toBe(3);
  });

  it('fails with a general server error for an unexpected failure', async () => {
    const exit = await Effect.runPromiseExit(
      runIn(
        runtime,
        Effect.fail(
          new CourseDatabaseError({
            operation: 'list vocabulary',
            cause: null,
            message: 'secret detail',
          }),
        ),
      ).pipe(Effect.provide(Logger.layer([]))),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).not.toContain('secret detail');
    expect(JSON.stringify(exit)).toContain('ServerError');
  });
});
