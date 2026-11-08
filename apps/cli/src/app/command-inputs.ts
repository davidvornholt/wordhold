import { IdSchema } from '@wordhold/api/vocabulary';
import { Effect, Option, Schema } from 'effect';
import { Argument, Flag } from 'effect/cli';
import { InvalidInput } from '../shared/errors/errors';

// Like `Flag.optional`, but a repeated flag is an error: the parser would keep
// the first value, so `--book a --book b` would silently mean the first one.
export const once = <A>(self: Flag.Flag<A>): Flag.Flag<Option.Option<A>> =>
  self.pipe(
    Flag.atMost(1),
    Flag.map((values) => Option.fromUndefinedOr(values[0])),
  );

export const optionalString = (name: string, description: string) =>
  once(Flag.String(name).pipe(Flag.withDescription(description)));

export const flag = (name: string, description: string) =>
  once(Flag.Boolean(name).pipe(Flag.withDescription(description))).pipe(
    Flag.map(Option.getOrElse(() => false)),
  );

export const fail = (message: string) =>
  Effect.fail(new InvalidInput({ message }));

/**
 * Checks a value against the schema the server will check it with, so a
 * mistake is reported here with a reason instead of as a bare rejection.
 */
export const validate =
  <T, E>(schema: Schema.Codec<T, E>, what: string) =>
  (value: E) =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError(
        (error) =>
          new InvalidInput({ message: `Invalid ${what}: ${error.message}` }),
      ),
    );

export const idArgument = (description: string, name = 'id') =>
  Argument.String(name).pipe(Argument.withDescription(description));

const decodeId = validate(IdSchema, 'id');

export const validId = (value: string) => decodeId(value.trim());
