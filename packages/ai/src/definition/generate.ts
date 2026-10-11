import type { LanguageModel } from 'ai';
import type { Effect, Schema } from 'effect';
import { generateStructured } from '../structured-generation';
import type { AiOperation, AiUsage } from '../usage';
import { DefinitionError } from './error';

// One structured request. The message names what could not be produced; the
// cause keeps the provider diagnostic.
export const generateDefinitionOutput = <A>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Decoder<A>;
  readonly prompt: string;
  readonly message: string;
  readonly validate?: (answer: A) => string | undefined;
}): Effect.Effect<A, DefinitionError, AiUsage> =>
  generateStructured({
    model: input.model,
    operation: input.operation,
    schema: input.schema,
    prompt: input.prompt,
    failure: (cause) => new DefinitionError({ cause, message: input.message }),
    validate: input.validate,
  });
