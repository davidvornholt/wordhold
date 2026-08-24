import { Extraction } from '@wordhold/ai/extraction';
import { VertexProvider } from '@wordhold/ai/providers/vertex';
import { Tts } from '@wordhold/ai/tts';
import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { OwnerRepositoryLive } from '../../shared/auth/owner-repository';
import { MediaRepositoryLive } from '../../shared/storage/media-service';
import { StorageLive } from '../../shared/storage/server';
import { ImportRepositoryLive } from './services/repository-live';

const databaseServices = Layer.mergeAll(
  ImportRepositoryLive,
  OwnerRepositoryLive,
  MediaRepositoryLive,
).pipe(Layer.provide(PgLive));

const extraction = Extraction.Default.pipe(Layer.provide(VertexProvider.live));

export const importRuntime = ManagedRuntime.make(
  Layer.mergeAll(databaseServices, StorageLive, extraction, Tts.Default),
);
