import { generateText, type LanguageModel, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { sonnetMediumProviderOptions } from '../providers/bedrock';
import { providerJsonSchema } from '../structured-output';
import { DefinitionError } from './error';

// One structured request, decoded with the Effect schema. The message names
// what could not be produced; the cause keeps the provider diagnostic.
export const generateDefinitionOutput = <A, I>(
  model: LanguageModel,
  schema: Schema.Schema<A, I>,
  prompt: string,
  message: string,
): Effect.Effect<A, DefinitionError> => {
  const failure = (cause: unknown) => new DefinitionError({ cause, message });
  return Effect.tryPromise({
    try: async () => {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: providerJsonSchema(schema) }),
        prompt,
        providerOptions: sonnetMediumProviderOptions,
      });
      return output;
    },
    catch: failure,
  }).pipe(
    Effect.flatMap((output) =>
      Schema.decodeUnknown(schema)(output).pipe(Effect.mapError(failure)),
    ),
  );
};
