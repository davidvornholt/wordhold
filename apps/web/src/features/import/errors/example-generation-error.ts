import { Schema } from 'effect';

export class ExampleGenerationError extends Schema.TaggedError<ExampleGenerationError>()(
  'ExampleGenerationError',
  { message: Schema.String },
) {}
