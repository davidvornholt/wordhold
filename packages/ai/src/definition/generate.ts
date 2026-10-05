import type { LanguageModel } from 'ai';
import { Effect, type Schema } from 'effect';
import { generateStructured } from '../structured-generation';
import { decodeModelOutput } from '../structured-output';
import type { AiOperation, AiUsage } from '../usage';
import { DefinitionError } from './error';

// One structured request, decoded with the Effect schema. The message names
// what could not be produced; the cause keeps the provider diagnostic.
export const generateDefinitionOutput = <A>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Decoder<A>;
  readonly prompt: string;
  readonly message: string;
}): Effect.Effect<A, DefinitionError, AiUsage> => {
  const failure = (cause: unknown) =>
    new DefinitionError({ cause, message: input.message });
  return generateStructured({
    model: input.model,
    operation: input.operation,
    schema: input.schema,
    prompt: input.prompt,
    failure,
  }).pipe(
    Effect.flatMap((output) =>
      decodeModelOutput(input.schema)(output).pipe(Effect.mapError(failure)),
    ),
  );
};
