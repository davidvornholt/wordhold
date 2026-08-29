import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { judgeModel } from '../config';
import { BedrockProvider } from '../providers/bedrock';
import {
  providerJsonSchema,
  structuredOutputOptions,
} from '../structured-output';
import { JudgeError } from './error';
import { type JudgeInput, JudgeVerdict, type JudgeVerdictData } from './schema';

// Luna reaches this service through AWS Mantle's Responses endpoint. Wordhold
// sends a strict text.format schema, but mocked transport tests cannot prove
// that Mantle accepts or enforces it. Keep the prompt-level quotation rule as a
// best-effort guard. Model output remains untrusted and may repeat quotation
// marks from prompt inputs.
const quotingRule =
  "When you quote a word, wrap it in single quotes ('wort'). Never use double quotes or typographic quotation marks anywhere in your answer.";

export const judgePrompt = (input: JudgeInput): string => {
  const answerLanguage =
    input.direction === 'to_target' ? input.targetLanguage : 'German';
  return [
    'You are a strict but fair language teacher grading a vocabulary answer.',
    `The learner translates a vocabulary entry into ${answerLanguage}.`,
    `Task shown to the learner: "${input.prompt}"`,
    `Expected answers: ${input.expectedAnswers.map((a) => `"${a}"`).join(', ')}`,
    `The learner answered: "${input.givenAnswer}"`,
    '',
    'The answer did not exactly match any expected answer. Judge it on each',
    'dimension: meaning, grammar, idiomaticity, spelling, and whether it uses',
    'the construction the textbook is teaching (intendedConstruction).',
    'Set correct=true only if a teacher would accept it as a valid answer.',
    'Set acceptAsAlternative=true only if it is a fully correct alternative',
    'translation worth remembering permanently, not a near miss.',
    'Write the explanation in German, at most two short sentences, addressing',
    'the learner directly.',
    quotingRule,
  ].join('\n');
};

export class Judge extends Effect.Service<Judge>()('@wordhold/ai/Judge', {
  effect: Effect.gen(function* () {
    const bedrock = yield* BedrockProvider;
    const modelId = yield* judgeModel;
    const verdictOutput = providerJsonSchema(JudgeVerdict);
    const decodeVerdict = Schema.decodeUnknown(JudgeVerdict);

    const judge = (
      input: JudgeInput,
    ): Effect.Effect<JudgeVerdictData, JudgeError> =>
      Effect.tryPromise({
        try: async () => {
          const { output } = await generateText({
            model: bedrock.responses(modelId),
            output: Output.object({ schema: verdictOutput }),
            prompt: judgePrompt(input),
            providerOptions: structuredOutputOptions,
          });
          return output;
        },
        catch: (cause) => new JudgeError({ cause }),
      }).pipe(
        Effect.flatMap((output) =>
          decodeVerdict(output).pipe(
            Effect.mapError((cause) => new JudgeError({ cause })),
          ),
        ),
      );
    return { judge, modelId } as const;
  }),
}) {}
