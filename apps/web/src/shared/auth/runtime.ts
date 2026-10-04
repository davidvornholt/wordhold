import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { MemberRepositoryLive } from './member-repository';

// Ownership checks query the database directly, so it stays in the runtime.
export const authRuntime = ManagedRuntime.make(
  MemberRepositoryLive.pipe(Layer.provideMerge(PgLive)),
);
