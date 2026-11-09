import { AnthropicProvider } from '@wordhold/ai/providers/anthropic';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { definitionLayer } from '../../../shared/ai/runtime';
import { UsageLedger } from '../../../shared/ai/usage-ledger';
import { StorageLive } from '../../../shared/storage/server';
import { CourseService } from './course-service';
import { CourseStore } from './course-store';
import { TermEntryService } from './term-entry-service';
import { TermEntryStore } from './term-entry-store';
import { TextEntryService } from './text-entry-service';
import { TextEntryStore } from './text-entry-store';
import { VocabularyEntryService } from './vocabulary-entry-service';
import { VocabularyEntryStore } from './vocabulary-entry-store';
import { VocabularyExampleService } from './vocabulary-example-service';
import { VocabularyExampleStore } from './vocabulary-example-store';

// The courses feature's runtimes, shared by its server functions and the
// CLI's API so both use one database pool each. A runtime builds its layers
// on first use, so importing this module runs nothing.

export const courseRuntime = ManagedRuntime.make(
  CourseService.layer.pipe(
    Layer.provide(CourseStore.live.pipe(Layer.provide(PgLive))),
  ),
);

// Examples and typed entries share one runtime: both talk to the sentence
// generator, text-to-speech and file storage.
const vocabularyDependencies = Layer.mergeAll(
  VocabularyExampleStore.live.pipe(Layer.provide(PgLive)),
  VocabularyEntryStore.live.pipe(Layer.provide(PgLive)),
  SentenceGen.layer.pipe(Layer.provide(AnthropicProvider.live)),
  StorageLive,
  Tts.layer,
  UsageLedger.live(PgLive),
);
export const vocabularyRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    VocabularyExampleService.layer,
    VocabularyEntryService.layer,
  ).pipe(Layer.provideMerge(vocabularyDependencies)),
);

export const termRuntime = ManagedRuntime.make(
  TermEntryService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        TermEntryStore.live.pipe(Layer.provide(PgLive)),
        definitionLayer,
      ),
    ),
    Layer.provideMerge(UsageLedger.live(PgLive)),
  ),
);

export const textRuntime = ManagedRuntime.make(
  TextEntryService.layer.pipe(
    Layer.provide(TextEntryStore.live.pipe(Layer.provide(PgLive))),
  ),
);
