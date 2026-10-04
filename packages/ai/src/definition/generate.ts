import type { LanguageModel } from 'ai';
import { Effect, Schema } from 'effect';
import { generateStructured } from '../structured-generation';
import type { AiOperation, AiUsage } from '../usage';
import { DefinitionError } from './error';

// One structured request, decoded with the Effect schema. The message names
// what could not be produced; the cause keeps the provider diagnostic.
export const generateDefinitionOutput = <A, I>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Schema<A, I>;
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
      Schema.decodeUnknown(input.schema)(output).pipe(Effect.mapError(failure)),
    ),
  );
};
