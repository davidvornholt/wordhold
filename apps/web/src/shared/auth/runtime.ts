import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { OwnerRepositoryLive } from './owner-repository';

const ownerLayer = OwnerRepositoryLive.pipe(Layer.provide(PgLive));

export const authRuntime = ManagedRuntime.make(ownerLayer);
