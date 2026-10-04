import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { MemberRepositoryLive } from '../auth/member-repository';
import { MediaRepositoryLive } from '../storage/media-service';
import { StorageLive } from '../storage/server';

// Ownership checks query the database directly, so it stays in the runtime.
const databaseServices = Layer.mergeAll(
  MemberRepositoryLive,
  MediaRepositoryLive,
).pipe(Layer.provideMerge(PgLive));

export const serverRuntime = ManagedRuntime.make(
  Layer.merge(databaseServices, StorageLive),
);
