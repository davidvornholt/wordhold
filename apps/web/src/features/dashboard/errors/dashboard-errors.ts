import { Schema } from 'effect';

export class DashboardDatabaseError extends Schema.TaggedError<DashboardDatabaseError>()(
  'DashboardDatabaseError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
