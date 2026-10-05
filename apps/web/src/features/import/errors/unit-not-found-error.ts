import { Schema } from 'effect';

// The verify screen offers the units a course had when it loaded. A unit
// deleted since then must fail instead of silently filing vocabulary elsewhere.
export class UnitNotFoundError extends Schema.TaggedError<UnitNotFoundError>()(
  'UnitNotFoundError',
  { message: Schema.String },
) {}
