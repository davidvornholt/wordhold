import { DefinitionJudge } from '@wordhold/ai/definition/judge';
import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Judge } from '@wordhold/ai/judge';
import { AnthropicProvider } from '@wordhold/ai/providers/anthropic';
import { SentenceGen } from '@wordhold/ai/sentence';
import { SentenceJudge } from '@wordhold/ai/sentence/judge';
import { PgLive } from '@wordhold/db/client';
import { Layer, ManagedRuntime } from 'effect';
import { UsageLedger } from './usage-ledger';

export const judgeLayer = Judge.layer.pipe(
  Layer.provide(AnthropicProvider.live),
);

export const definitionLayer = Layer.merge(
  DefinitionJudge.layer,
  DefinitionWriter.layer,
).pipe(Layer.provide(AnthropicProvider.live));

export const sentenceJudgeLayer = SentenceJudge.layer.pipe(
  Layer.provide(AnthropicProvider.live),
);

// Runtimes build lazily.
export const sentenceRuntime = ManagedRuntime.make(
  Layer.merge(
    SentenceGen.layer.pipe(Layer.provide(AnthropicProvider.live)),
    UsageLedger.live(PgLive),
  ),
);
