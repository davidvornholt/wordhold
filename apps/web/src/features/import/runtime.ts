import { Extraction } from '@wordhold/ai/extraction';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { Tts } from '@wordhold/ai/tts';
import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { UsageLedger } from '../../shared/ai/usage-ledger';
import { MemberRepositoryLive } from '../../shared/auth/member-repository';
import { MediaRepositoryLive } from '../../shared/storage/media-service';
import { StorageLive } from '../../shared/storage/server';
import { AudioGenerationStoreLive } from './services/audio-generation-store';
import { ImportRepositoryLive } from './services/repository-live';

// Ownership checks query the database directly, so it stays in the runtime.
const databaseServices = Layer.mergeAll(
  AudioGenerationStoreLive,
  ImportRepositoryLive,
  MemberRepositoryLive,
  MediaRepositoryLive,
  UsageLedger.live,
).pipe(Layer.provideMerge(PgLive));

const extraction = Extraction.Default.pipe(Layer.provide(BedrockProvider.live));

export const importRuntime = ManagedRuntime.make(
  Layer.mergeAll(databaseServices, StorageLive, extraction, Tts.Default),
);
