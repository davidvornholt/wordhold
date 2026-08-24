import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { OwnerRepositoryLive } from '../auth/owner-repository';
import { MediaRepositoryLive } from '../storage/media-service';
import { StorageLive } from '../storage/server';

const databaseServices = Layer.mergeAll(
  OwnerRepositoryLive,
  MediaRepositoryLive,
).pipe(Layer.provide(PgLive));

export const serverRuntime = ManagedRuntime.make(
  Layer.merge(databaseServices, StorageLive),
);
