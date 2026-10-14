import { Effect } from 'effect';
import { prepareMigratedTestDatabases } from './postgres-test-database';

// Bun awaits preloads before the first test file and outside every test
// timeout, so the one-time template build never counts against a test.
await Effect.runPromise(prepareMigratedTestDatabases);
