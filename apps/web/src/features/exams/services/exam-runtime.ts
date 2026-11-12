import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { ExamService } from './exam-service';
import { ExamStore } from './exam-store';

// A runtime builds its layers on first use, so importing this module runs
// nothing.
export const examRuntime = ManagedRuntime.make(
  ExamService.layer.pipe(
    Layer.provide(ExamStore.live.pipe(Layer.provide(PgLive))),
  ),
);
