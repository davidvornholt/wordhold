import { Extraction } from '@wordhold/ai/extraction';
import { Judge } from '@wordhold/ai/judge';
import { VertexProvider } from '@wordhold/ai/providers/vertex';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Layer, ManagedRuntime } from 'effect';

// Runtimes build lazily; speech remains independent of Vertex credentials.
export const extractionRuntime = ManagedRuntime.make(
  Extraction.Default.pipe(Layer.provide(VertexProvider.live)),
);

export const judgeLayer = Judge.Default.pipe(
  Layer.provide(VertexProvider.live),
);

export const sentenceRuntime = ManagedRuntime.make(
  SentenceGen.Default.pipe(Layer.provide(VertexProvider.live)),
);

export const ttsRuntime = ManagedRuntime.make(Tts.Default);
