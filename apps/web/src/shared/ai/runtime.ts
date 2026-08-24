import { Extraction } from '@wordhold/ai/extraction';
import { Judge } from '@wordhold/ai/judge';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { VertexProvider } from '@wordhold/ai/providers/vertex';
import { SentenceGen } from '@wordhold/ai/sentence';
import { Tts } from '@wordhold/ai/tts';
import { Layer, ManagedRuntime } from 'effect';

// One runtime per service keeps failure domains independent: extraction
// (Google credentials) still works when AWS credentials are absent, and
// vice versa. Runtimes build lazily on first use.
export const extractionRuntime = ManagedRuntime.make(
  Extraction.Default.pipe(Layer.provide(VertexProvider.live)),
);

export const judgeLayer = Judge.Default.pipe(
  Layer.provide(BedrockProvider.live),
);

export const sentenceRuntime = ManagedRuntime.make(
  SentenceGen.Default.pipe(Layer.provide(BedrockProvider.live)),
);

export const ttsRuntime = ManagedRuntime.make(Tts.Default);
