import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { MemberRepositoryLive } from '../../shared/auth/member-repository';
import { BibleService } from './services/bible-service';
import { BibleStore } from './services/bible-store';

// The upload route checks the member itself, so the member repository is in
// the runtime as well.
export const bibleRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    BibleService.Default.pipe(Layer.provide(BibleStore.live)),
    MemberRepositoryLive,
  ).pipe(Layer.provideMerge(PgLive)),
);
