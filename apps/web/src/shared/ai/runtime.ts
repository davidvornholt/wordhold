import { DefinitionJudge } from '@wordhold/ai/definition/judge';
import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Extraction } from '@wordhold/ai/extraction';
import { Judge } from '@wordhold/ai/judge';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { SentenceGen } from '@wordhold/ai/sentence';
import { SentenceJudge } from '@wordhold/ai/sentence/judge';
import { Tts } from '@wordhold/ai/tts';
import { Layer, ManagedRuntime } from 'effect';

// Runtimes build lazily; speech remains independent of the AI model.
export const extractionRuntime = ManagedRuntime.make(
  Extraction.Default.pipe(Layer.provide(BedrockProvider.live)),
);

export const judgeLayer = Judge.Default.pipe(
  Layer.provide(BedrockProvider.live),
);

export const definitionLayer = Layer.merge(
  DefinitionJudge.Default,
  DefinitionWriter.Default,
).pipe(Layer.provide(BedrockProvider.live));

export const sentenceJudgeLayer = SentenceJudge.Default.pipe(
  Layer.provide(BedrockProvider.live),
);

export const sentenceRuntime = ManagedRuntime.make(
  SentenceGen.Default.pipe(Layer.provide(BedrockProvider.live)),
);

export const ttsRuntime = ManagedRuntime.make(Tts.Default);
