import { Effect, Layer } from 'effect';
import { AiUsage } from '../usage';

// For tests that do not look at usage: every request may start and nothing
// is recorded.
export const untrackedAiUsage = Layer.succeed(
  AiUsage,
  AiUsage.of({ start: () => Effect.succeed({ settle: () => Effect.void }) }),
);
