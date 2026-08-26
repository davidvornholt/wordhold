import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { judgeModel } from '../config';
import { BedrockProvider } from '../providers/bedrock';
import { providerJsonSchema } from '../structured-output';
import { JudgeError } from './error';
import { type JudgeInput, JudgeVerdict, type JudgeVerdictData } from './schema';

// Anthropic on Bedrock answers a structured-output request with plain JSON
// text. A model that writes a German quotation pair as „wort" ends the JSON
// string on that unescaped quote: everything after it is lost and the truncated
// remainder still parses, so a learner sees half a sentence. Asking for single
// quotes is only a best-effort mitigation. Model output remains untrusted and
// may ignore the instruction or repeat quotation marks from prompt inputs.
const quotingRule =
  "When you quote a word, wrap it in single quotes ('wort'). Never use double quotes or typographic quotation marks anywhere in your answer.";

export const judgePrompt = (input: JudgeInput): string => {
  const answerLanguage =
    input.direction === 'to_target' ? input.targetLanguage : 'German';
  return [
    'You are a strict but fair language teacher grading a vocabulary answer.',
    `The learner translates a ${input.entryType} into ${answerLanguage}.`,
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
            model: bedrock(modelId),
            output: Output.object({ schema: verdictOutput }),
            prompt: judgePrompt(input),
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
